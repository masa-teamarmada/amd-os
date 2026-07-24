"use client";

import { useEffect, useState, useMemo, useCallback, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { LinkedMemberText } from "@/components/members/LinkedMemberText";
import { createClient } from "@/lib/supabase/client";
import {
  l2NotificationPriority,
  meetingNotificationPriority,
  notificationPriorityLabel,
  type NotificationPriority,
} from "@/lib/notification-priority";
import type { Notification, MeetingNotification, Feedback } from "@/app/(app)/notifications/page";

type Props = {
  l2: Notification[];
  mtg: MeetingNotification[];
  feedbacks: Feedback[];
  focus?: {
    l2NotificationId?: string | null;
    meetingId?: string | null;
  };
  projectMap: Record<string, string>;
};

type UnifiedItem =
  | { kind: "l2"; data: Notification }
  | { kind: "meeting"; data: MeetingNotification };

type FeedbackAction = "yes" | "no" | "comment";
const ANSWERED_CARD_HIDE_MS = 3500;

// 展開時に lazy fetch する実データの型
type DetailRow = {
  loading: boolean;
  error?: string;
  // 1 行 = 1 抽出項目
  rows?: Array<{ heading: string; body: string; sub?: string }>;
};

const COVERAGE_GAP_UNAVAILABLE_HEADING = "このカードだけではコピー対象を判断できない";

function parseProtocolNotificationScope(scopeKey: string): { ym: string; protocolId: string | null } {
  const scoped = scopeKey.match(/^(20\d{4}):protocol:([^:]+)$/);
  if (scoped) {
    return { ym: scoped[1], protocolId: scoped[2] };
  }
  const ym = scopeKey.match(/20\d{4}/)?.[0] ?? scopeKey.slice(0, 6);
  return { ym, protocolId: null };
}

function notificationYm(scopeKey: string): string {
  return scopeKey.match(/20\d{4}/)?.[0] ?? scopeKey.slice(0, 6);
}

// l2_kind → どの L2 抽出器が出した通知か (= operations-catalog.ts の M/W/D/H L2 と対応)。
// 通知カードに「D-6 経営ハイライト」のように番号 + 名前で出すための正本マップ。
// 番号の根拠: pwa/lib/operations-catalog.ts / pwa/design/L2_DATA.md
const L2_KIND_LABEL: Record<string, string> = {
  protocols: "D-1 AMDプロトコル",
  ms_progress: "D-2 MS進捗",
  ms_progress_revision: "D-2 MS進捗修正提案",
  ms_schedule_delay: "D-2 MS計画遅延",
  project_knowledge: "D-3 PJナレッジ",
  member_knowledge: "D-4 メンバーナレッジ",
  meeting_summary: "H-1 MTGサマリ",
  // D-5 OS台帳差分 系 (台帳に反映する候補)
  project_registry_diff: "D-5 OS台帳差分",
  project_member_candidate: "D-5 OS台帳差分",
  project_contact_candidate: "D-5 OS台帳差分",
  raw_data_gap: "D-5 OS台帳差分",
  project_config_gap: "D-5 OS台帳差分",
  // M-2 XRL根拠 系 (AMD Score / XRL 算定根拠。founding_members は HRL ベース)
  xrl_evidence: "M-2 XRL根拠",
  founding_members: "M-2 XRL根拠",
  // D-6 経営ハイライト
  project_strategy_signal: "D-6 経営ハイライト",
  // D-7 Textbook Insights
  textbook_insight: "D-7 Textbook Insights",
  // D-13 契約予兆
  contract_signals: "D-13 契約予兆",
  // D-11 メディア掲載
  news_mention: "D-11 メディア掲載",
  // Coverage Scanner (不在検知 / negative space)。既存抽出器の上位の安全網。
  coverage_gap: "会議メモの確認",
  guardrail_match: "経営ガードレール",
};

function l2KindLabel(l2Kind: string): string {
  return L2_KIND_LABEL[l2Kind] ?? l2Kind;
}

function isCoverageGapItem(i: UnifiedItem): boolean {
  return i.kind === "l2" && i.data.l2_kind === "coverage_gap";
}

function isGovernanceCoverageGap(n: Notification): boolean {
  const meta = objectValue(n.metadata_json);
  return normalizeCoverageTarget(textFromUnknown(meta.proposed_target_l2)) === "shareholder_meeting";
}

type GovernanceActionContract = {
  destination: string;
  href: string;
  changes: string[];
  approvalLabel: string;
  rejectionLabel: string;
  approvalEffect: string;
  rejectionEffect: string;
};

function governanceActionContract(n: Notification): GovernanceActionContract {
  const meta = objectValue(n.metadata_json);
  const stored = objectValue(meta.action_contract);
  const storedChanges = Array.isArray(stored.changes)
    ? stored.changes.map(textFromUnknown).filter(Boolean)
    : [];
  const meetingType = textFromUnknown(meta.meeting_type) || "未確認";
  const meetingDate = textFromUnknown(meta.meeting_date) || "未確認";
  const agenda = textFromUnknown(meta.agenda_summary);
  const resolutionCount = Number(meta.resolution_count);
  const attachmentNames = Array.isArray(meta.attachment_names)
    ? meta.attachment_names.map(textFromUnknown).filter(Boolean)
    : [];
  return {
    destination: textFromUnknown(stored.destination_label) || "会社概要 → 総会・取締役会",
    href: textFromUnknown(stored.destination_href) || `/project/${n.target_id}/cockpit?tab=company`,
    changes: storedChanges.length > 0 ? storedChanges : [
      `会議種別: ${meetingType}`,
      `開催日: ${meetingDate}`,
      `議題: ${agenda || "根拠欄で確認"}`,
      `決議: ${Number.isFinite(resolutionCount) && resolutionCount > 0 ? `${resolutionCount}件` : "根拠欄で確認"}`,
      `添付: ${attachmentNames.length > 0 ? attachmentNames.join("、") : "根拠欄で確認"}`,
    ],
    approvalLabel: textFromUnknown(stored.approval_label) || "この開催履歴を追加する",
    rejectionLabel: textFromUnknown(stored.rejection_label) || "追加しない",
    approvalEffect: textFromUnknown(stored.approval_effect) || "会社概要の「総会・取締役会」に開催履歴を1件追加する。メール送信、資料アップロード、元メールや元資料の編集はしない。",
    rejectionEffect: textFromUnknown(stored.rejection_effect) || "この候補を見送る。会社概要の開催履歴は追加しない。",
  };
}

function isTextbookInsightItem(i: UnifiedItem): boolean {
  return i.kind === "l2" && i.data.l2_kind === "textbook_insight";
}

function itemDisplayTitle(i: UnifiedItem): string {
  if (isCoverageGapItem(i)) return coverageGapQuestionTitle(i.data as Notification);
  return sanitizeMeetingTitle(i.data.title);
}

function itemMetaLabel(i: UnifiedItem, projectMap: Record<string, string>): string {
  if (isCoverageGapItem(i)) {
    const n = i.data as Notification;
    if (isGovernanceCoverageGap(n)) return `開催履歴の追加 / ${projectMap[n.target_id] ?? n.target_id}`;
    return `会議メモの確認 / ${projectMap[n.target_id] ?? n.target_id}`;
  }
  if (i.kind === "l2") {
    return `${l2KindLabel(i.data.l2_kind)} (${i.data.l2_kind}) / ${displayTarget(i.data.target_id, i.data.scope_key, projectMap)}`;
  }
  return `H-1 MTGサマリ / ${projectMap[i.data.project_id] ?? i.data.project_id}`;
}

function isAlreadySavedForReview(i: UnifiedItem): boolean {
  // coverage_gap は「候補行が保存済み」でも、まさの yes/no 判断はまだ未完了。
  // 既存データに saved_count=1,total_count=1 の行があるので、ここだけ明示的に review 扱いに戻す。
  if (isCoverageGapItem(i)) return false;
  return i.kind === "l2"
    && Number(i.data.total_count ?? 0) > 0
    && Number(i.data.saved_count ?? 0) >= Number(i.data.total_count ?? 0);
}

type ReviewActionCopy = {
  yesLabel: string;
  noLabel: string;
  yesDoneLabel: string;
  noDoneLabel: string;
  prompt: string;
  footnote: string;
  placeholder: string;
  headlineLabel: string;
};

function reviewActionCopyForItem(i: UnifiedItem, alreadySaved: boolean): ReviewActionCopy {
  if (isCoverageGapItem(i)) return coverageGapActionCopy(i.data as Notification);
  if (isTextbookInsightItem(i)) {
    return {
      yesLabel: "BZM追記を承認",
      noLabel: "BZMには入れない",
      yesDoneLabel: "BZM追記を承認",
      noDoneLabel: "BZMには入れない",
      prompt: "AMD OS内の記録から抜き出した学びを、BZM / Before Zero 実践テキストに残すか判断する。元のAMDプロトコルや会議メモは書き換えない。",
      footnote: "承認しても、この画面からBZM本文を直接書き換えない。後続のローカル反映処理が、承認済み候補だけをBZMのmdへ追記する。",
      placeholder: "例: BZM向き / AMDプロトコルだけでよい / 抽象化し直して",
      headlineLabel: "通知ヘッドライン",
    };
  }
  return {
    yesLabel: alreadySaved ? "はい・確認済み" : "はい・反映",
    noLabel: "いいえ・不採用",
    yesDoneLabel: alreadySaved ? "はい・確認済み" : "はい・反映",
    noDoneLabel: "いいえ・不採用",
    prompt: alreadySaved
      ? "これは既に正本へ保存済みの通知。内容が正しければ「はい・確認済み」、違っていれば「いいえ・不採用」。補足だけ残すならコメントだけ送信。"
      : "反映してよければ「はい・反映」、違っていれば「いいえ・不採用」。補足だけ残すならコメントだけ送信。",
    footnote: alreadySaved
      ? "はい/いいえ/コメントは admin/tsukuyomi の学習リストに残る。保存済み通知の「はい」は確認済みフィードバックとして扱う。"
      : "はい/いいえ/コメントは admin/tsukuyomi の学習リストに残る。安全に反映できる候補は「はい」でSupabaseへ反映する。",
    placeholder: "任意コメント。例: 今回は契約レビューだけなのでPJメンバーには入れない / 品質確認として継続参加なので登録してOK",
    headlineLabel: "通知ヘッドライン",
  };
}

function responseLabelForItem(action: FeedbackAction, i: UnifiedItem, alreadySaved: boolean): string {
  const copy = reviewActionCopyForItem(i, alreadySaved);
  if (action === "yes") return copy.yesDoneLabel;
  if (action === "no") return copy.noDoneLabel;
  return "コメント送信済み";
}

function detailTitleForItem(i: UnifiedItem): string | undefined {
  if (isCoverageGapItem(i)) return "確認したい内容";
  if (isTextbookInsightItem(i)) return "BZMに追記する候補";
  return undefined;
}

function unifiedItemPriority(i: UnifiedItem): NotificationPriority {
  return i.kind === "l2"
    ? l2NotificationPriority(i.data)
    : meetingNotificationPriority(i.data);
}

export function NotificationsClient({ l2, mtg, feedbacks, focus, projectMap }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [feedbackTexts, setFeedbackTexts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [localFeedbacks, setLocalFeedbacks] = useState<Feedback[]>(feedbacks);
  const [answeredMap, setAnsweredMap] = useState<Record<string, FeedbackAction>>({});
  const [recentlyAnsweredKeys, setRecentlyAnsweredKeys] = useState<Set<string>>(new Set());
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
  const [focusHandledKey, setFocusHandledKey] = useState<string | null>(null);
  const answerHideTimeoutsRef = useRef<Record<string, number>>({});
  const scrollRestoreRef = useRef<{
    primaryKey: string;
    fallbackKey: string | null;
    beforeTop: number | null;
    beforeScrollY: number;
  } | null>(null);

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
  const focusedKey = focus?.l2NotificationId
    ? `l2-${focus.l2NotificationId}`
    : focus?.meetingId
      ? `mtg-${focus.meetingId}`
      : null;
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
  const isRecentlyAnswered = (i: UnifiedItem): boolean => recentlyAnsweredKeys.has(itemKey(i));
  const hasFeedbackForItem = (i: UnifiedItem): boolean => findFeedbacksFor(i).length > 0;
  const isReadUi = (i: UnifiedItem): boolean => {
    const key = itemKey(i);
    if (unreadOverride.has(key)) return false;
    return !!serverReadAt(i) || !!readMap[key] || !!answeredMap[key] || hasFeedbackForItem(i);
  };

  // フィルタ: 回答済み通知はその場で未読から外す。
  const filtered = (() => {
    const withFocused = (list: UnifiedItem[]) => {
      if (!focusedKey || list.some((i) => itemKey(i) === focusedKey)) return list;
      const focused = items.find((i) => itemKey(i) === focusedKey);
      return focused ? [focused, ...list] : list;
    };
    if (filter === "open") {
      return withFocused(items.filter((i) => !isAnswered(i) || isRecentlyAnswered(i)));
    }
    if (filter === "unread") {
      return withFocused(items.filter((i) => (!isReadUi(i) && !isAnswered(i)) || isRecentlyAnswered(i)));
    }
    if (filter === "answered") {
      return withFocused(items.filter((i) => isAnswered(i)));
    }
    if (filter === "feedback") {
      return withFocused(items.filter((i) => hasFeedbackForItem(i)));
    }
    return withFocused(items.filter((i) => !isAnswered(i)));
  })();

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
            .select("protocol_id, occurred_on, summary, branch_point, criteria, action_taken, result")
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
            const examplesByPid = new Map<string, Array<{ occurred_on: string | null; summary: string | null; branch_point: string | null; criteria: string | null; action_taken: string | null; result: string | null }>>();
            for (const e of (examples ?? [])) {
              const pid = e.protocol_id as string;
              const list = examplesByPid.get(pid) ?? [];
              list.push({
                occurred_on: e.occurred_on as string | null,
                summary: e.summary as string | null,
                branch_point: e.branch_point as string | null,
                criteria: e.criteria as string | null,
                action_taken: e.action_taken as string | null,
                result: e.result as string | null,
              });
              examplesByPid.set(pid, list);
            }
            rows = (protocols ?? []).map((r) => {
              const exs = examplesByPid.get(r.protocol_id as string) ?? [];
              const exText = exs
                .map((e) => {
                  const lines = [`・[${e.occurred_on ?? "—"}] ${e.summary ?? ""}`];
                  if (e.branch_point) lines.push(`  分岐点: ${e.branch_point}`);
                  if (e.criteria) lines.push(`  判断材料: ${e.criteria}`);
                  if (e.action_taken) lines.push(`  アクション: ${e.action_taken}`);
                  if (e.result) lines.push(`  結果: ${e.result}`);
                  return lines.join("\n");
                })
                .join("\n\n");
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
        } else if (n.l2_kind === "raw_data_gap") {
          const evidenceRows = rawDataGapEvidenceRows(n);
          const ingestedMeetingRows = await rawDataGapIngestedMeetingRows(supabase, n);
          if (ingestedMeetingRows.length > 0) {
            rows = [...ingestedMeetingRows, ...evidenceRows];
          } else if (evidenceRows.length > 0) {
            rows = [
              {
                heading: "未取り込み判定の根拠",
                body: "この通知は古いOS snapshotと外部ソースの差分から出てる。下の根拠がすでにDBへ取り込まれている場合は、取り込み済み表示が先頭に出る。",
              },
              ...evidenceRows,
            ];
            // metadata_json.evidence_refs を正本として表示する。fallback の source_cache 全件表示は最後の保険。
          } else {
            const ym = notificationYm(n.scope_key);
            const { data, error } = await supabase
              .from("source_cache")
              .select("source, item_id, title, item_date, content_text, metadata_json, collected_at")
              .eq("project_id", n.target_id)
              .eq("ym", ym)
              .order("item_date", { ascending: false })
              .limit(20);
            if (error) throw error;
            rows = (data ?? []).map((r) => {
              const meta = objectValue(r.metadata_json);
              const sourceUrl = textFromUnknown(meta.source_url) || textFromUnknown(meta.permalink);
              const hash = textFromUnknown(meta.text_sha256);
              return {
                heading: `${String(r.source).toUpperCase()}: ${r.title ?? "(no title)"}`,
                body: truncateOneLine(String(r.content_text ?? "")),
                sub: [
                  r.item_date ? formatJST(String(r.item_date)) : "",
                  r.collected_at ? `collected=${formatJST(String(r.collected_at))}` : "",
                  sourceUrl ? `url=${sourceUrl}` : "",
                  hash ? `hash=${hash.slice(0, 12)}` : "",
                  r.item_id ? `item=${r.item_id}` : "",
                ].filter(Boolean).join(" · ") || undefined,
              };
            });
          }
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
          const meta = objectValue(n.metadata_json);
          const ym = notificationYm(n.scope_key);
          let query = supabase
            .from("project_xrl_evidence")
            .select("axis, evidence_kind, summary, structured_value_json, source_refs_json, source_hash, confidence, status, created_at, confirmed_at")
            .eq("project_id", n.target_id);
          query = textFromUnknown(meta.axis) ? query.eq("axis", textFromUnknown(meta.axis).toLowerCase()) : query;
          query = textFromUnknown(meta.evidence_kind) ? query.eq("evidence_kind", textFromUnknown(meta.evidence_kind)) : query;
          const scopedQuery = n.scope_key === "global"
            ? query.is("ym", null)
            : query.eq("ym", ym);
          const { data, error } = await scopedQuery.order("created_at", { ascending: false }).limit(50);
          if (error) throw error;
          const metadataHash = textFromUnknown(meta.evidence_source_hash);
          const narrowed = metadataHash
            ? (data ?? []).filter((r) => xrlRowMatchesHash(r, metadataHash))
            : (data ?? []);
          rows = (narrowed.length > 0 ? narrowed : (data ?? [])).map((r) => {
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
          if (rows.length === 0) {
            rows = xrlNotificationFallbackRows(n);
          }
        } else if (n.l2_kind === "project_strategy_signal") {
          const meta = objectValue(n.metadata_json);
          const ym = notificationYm(n.scope_key);
          let query = supabase
            .from("project_strategy_signals")
            .select("signal_type, title, summary, impact_level, decision_state, status, source_refs_json, source_hash, confidence, signal_date, confirmed_at")
            .eq("project_id", n.target_id);
          query = textFromUnknown(meta.signal_type) ? query.eq("signal_type", textFromUnknown(meta.signal_type)) : query;
          const scopedQuery = n.scope_key === "global"
            ? query.is("ym", null)
            : query.eq("ym", ym);
          const { data, error } = await scopedQuery.order("created_at", { ascending: false }).limit(50);
          if (error) throw error;
          const metadataHash = textFromUnknown(meta.signal_source_hash);
          const narrowed = metadataHash
            ? (data ?? []).filter((r) => strategySignalRowMatchesHash(r, metadataHash))
            : (data ?? []);
          rows = (narrowed.length > 0 ? narrowed : (data ?? [])).map((r) => {
            const refs = Array.isArray(r.source_refs_json) ? r.source_refs_json : [];
            const refText = refs
              .slice(0, 3)
              .map((e) => {
                const ref = e && typeof e === "object" ? e as Record<string, unknown> : {};
                return [
                  ref.source || ref.type || "source",
                  ref.date || ref.item_date || "",
                  ref.title || ref.snippet || ref.summary || "",
                ].filter(Boolean).join(" / ");
              })
              .filter(Boolean)
              .join("\n");
            return {
              heading: `${r.signal_type} / ${r.impact_level} [${r.status}]`,
              body: [
                `${r.title}\n${r.summary}`,
                refText ? `根拠:\n${refText}` : "",
              ].filter(Boolean).join("\n"),
              sub: [
                r.signal_date ? `date=${r.signal_date}` : "",
                r.decision_state ? `state=${r.decision_state}` : "",
                r.confidence != null ? `confidence=${Number(r.confidence).toFixed(2)}` : "",
                r.confirmed_at ? `confirmed=${formatJST(String(r.confirmed_at))}` : "",
              ].filter(Boolean).join(" · ") || undefined,
            };
          });
          if (rows.length === 0) {
            rows = strategySignalNotificationFallbackRows(n);
          }
        } else if (n.l2_kind === "textbook_insight") {
          const meta = objectValue(n.metadata_json);
          const candidateId = textFromUnknown(meta.candidate_id);
          const sourceHash = textFromUnknown(meta.candidate_source_hash);
          let query = supabase
            .from("textbook_insight_candidates")
            .select("candidate_id, title, topic, proposed_section, target_bzm_slug, insight_type, priority, body_md, evidence_refs, source_tables, source_hash, status, reviewed_at, applied_at, applied_file, metadata_json, confidentiality, bzm_review_required, bzm_review_status, theory_change_scope")
            .eq("target_id", n.target_id);
          if (candidateId) {
            query = query.eq("candidate_id", candidateId);
          } else if (sourceHash) {
            query = query.eq("source_hash", sourceHash);
          } else {
            query = query.eq("scope_key", n.scope_key);
          }
          const { data, error } = await query.order("created_at", { ascending: false }).limit(20);
          if (error) throw error;
          rows = (data ?? []).map((r) => {
            const refs = Array.isArray(r.evidence_refs) ? r.evidence_refs : [];
            const sourceTables = Array.isArray(r.source_tables) ? r.source_tables.map(String).filter(Boolean) : [];
            const candidateMeta = objectValue(r.metadata_json);
            const practiceKind = textFromUnknown(candidateMeta.practice_kind) || "decision_branch";
            const appendTarget = textbookAppendTargetText(textFromUnknown(r.target_bzm_slug), textFromUnknown(r.proposed_section), practiceKind);
            const sourceSummary = textbookSourceSummary(sourceTables, refs);
            const bodyText = cleanTextbookBodyMarkdown(String(r.body_md ?? ""));
            return {
              heading: `BZMに追記する候補: ${r.title}`,
              body: [
                `元情報:\n${sourceSummary}`,
                "通知の種類:\nD-7 Textbook Insights。AMD OS内の記録から、BZM / Before Zero 実践テキストに残せそうな学びを候補化した通知。",
                `追記先:\n${appendTarget}`,
                `BZMに追記される内容:\n${bodyText || "追記候補本文が空。判断せず、コメントで再抽出を依頼してね。"}`,
                `判断の目安:\n${textbookDecisionGuide(String(r.insight_type ?? ""), Number(r.priority ?? 0), practiceKind, sourceTables)}`,
                "押すと起きること:\n「BZM追記を承認」を押すと、この候補が承認済みになる。Web本番からBZM本文を直接書き換えず、後続のローカル反映処理が承認済み候補だけをBZMのmdへ追記する。「BZMには入れない」を押すと候補を不採用にする。",
                `AMDプロトコルとの関係:\n${textbookProtocolRelationship(sourceTables, practiceKind)}`,
              ].filter(Boolean).join("\n\n"),
              sub: [
                `状態: ${textbookCandidateStatusLabel(String(r.status ?? ""))}`,
                textbookReviewGateText(Boolean(r.bzm_review_required), textFromUnknown(r.bzm_review_status), textFromUnknown(r.theory_change_scope)),
                r.applied_file ? `applied=${r.applied_file}` : "",
                r.applied_at ? `applied_at=${formatJST(String(r.applied_at))}` : "",
              ].filter(Boolean).join(" · ") || undefined,
            };
          });
        } else if (n.l2_kind === "news_mention") {
          const meta = objectValue(n.metadata_json);
          const sourceUrl = textFromUnknown(meta.source_url);
          const occurredOn = textFromUnknown(meta.occurred_on);
          let query = supabase
            .from("project_media_mentions")
            .select("occurred_on, title, media_name, kind, source_url, summary, ingested_by, verified, dismissed, created_at")
            .eq("project_id", n.target_id);
          if (sourceUrl) {
            query = query.eq("source_url", sourceUrl);
          } else if (occurredOn) {
            query = query.eq("occurred_on", occurredOn);
          } else {
            query = query.ilike("title", `%${stripNotificationPrefix(n.title)}%`);
          }
          const { data, error } = await query.order("created_at", { ascending: false }).limit(10);
          if (error) throw error;
          rows = (data ?? []).map((r) => ({
            heading: `${r.title} [${r.kind}]`,
            body: [
              r.summary || n.summary || "(summaryなし)",
              r.source_url ? `URL: ${r.source_url}` : "",
            ].filter(Boolean).join("\n"),
            sub: [
              r.occurred_on ? `date=${r.occurred_on}` : "",
              r.media_name ? `media=${r.media_name}` : "",
              r.ingested_by ? `by=${r.ingested_by}` : "",
              r.verified ? "verified" : "unverified",
              r.dismissed ? "dismissed" : "",
            ].filter(Boolean).join(" · ") || undefined,
          }));
        } else if (n.l2_kind === "coverage_gap") {
          // 不在検知 gap の中身を l2_coverage_gaps から取得 (scope_key = gap_id)。
          const { data, error } = await supabase
            .from("l2_coverage_gaps")
            .select("gap_id, source, source_ref, title, summary, salience_score, proposed_target_l2, gap_class, due_at, scope, review_status, evidence_refs_json, detected_at")
            .eq("gap_id", n.scope_key)
            .limit(1);
          if (error) throw error;
          rows = (data ?? []).map((r) => {
            if (normalizeCoverageTarget(textFromUnknown(r.proposed_target_l2)) === "shareholder_meeting") {
              const meeting = objectValue(objectValue(r.evidence_refs_json).governance_meeting);
              const resolutions = Array.isArray(meeting.resolutions_json) ? meeting.resolutions_json : [];
              const attachments = Array.isArray(meeting.attachments_json) ? meeting.attachments_json : [];
              const resolutionLines = resolutions
                .map((value) => {
                  if (typeof value === "string") return textFromUnknown(value);
                  const resolution = objectValue(value);
                  return textFromUnknown(resolution.title) || textFromUnknown(resolution.resolution) || textFromUnknown(resolution.summary);
                })
                .filter(Boolean)
                .slice(0, 10);
              const attachmentNames = attachments
                .map((value) => textFromUnknown(objectValue(value).name))
                .filter(Boolean)
                .slice(0, 10);
              return {
                heading: "会社概要に追加する開催履歴",
                body: [
                  `会議種別: ${textFromUnknown(meeting.meeting_type) || "未確認"}`,
                  `開催日: ${textFromUnknown(meeting.meeting_date) || "未確認"}`,
                  `議題: ${textFromUnknown(meeting.agenda_summary) || String(r.summary ?? "未確認")}`,
                  `決議: ${resolutionLines.length > 0 ? resolutionLines.map((value) => `・${value}`).join("\n") : "記載なし"}`,
                  `添付: ${attachmentNames.length > 0 ? attachmentNames.join("、") : "記載なし"}`,
                ].join("\n"),
                sub: "採用すると、会社概要 → 総会・取締役会にこの開催履歴を1件追加する。",
              };
            }
            const summary = String(r.summary ?? n.summary ?? "");
            const evidence = objectValue(r.evidence_refs_json);
            const copyMemo = coverageGapCopyMemo(summary, evidence, String(r.title ?? n.title ?? ""));
            const decisionGuide = coverageGapDecisionGuide(copyMemo, summary);
            return {
              heading: "重要メモにコピーされる内容",
              body: [
                `コピーされる文章:\n${copyMemo}`,
                `判断の目安:\n${decisionGuide}`,
                `コピーしても起きないこと:\n${coverageGapCopyNonConsequence(textFromUnknown(r.proposed_target_l2))}`,
              ].filter(Boolean).join("\n\n"),
              sub: [
                "上の文章を重要メモに残すかだけ判断",
                r.due_at ? `期限: ${formatJST(String(r.due_at))}` : "",
                r.detected_at ? `確認日: ${formatJST(String(r.detected_at))}` : "",
              ].filter(Boolean).join(" · ") || undefined,
            };
          });
        } else if (n.l2_kind === "guardrail_match") {
          const meta = objectValue(n.metadata_json);
          const { data, error } = await supabase
            .from("guardrail_matches")
            .select("match_id, card_id, target_type, target_id, target_title, target_date, matched_tags, project_tags, action_tags, match_score, severity, status, due_at, evidence_refs_json, detected_at")
            .eq("match_id", n.scope_key)
            .limit(1);
          if (error) throw error;
          rows = (data ?? []).map((r) => {
            const checks = Array.isArray(meta.check_items) ? meta.check_items.map(String).filter(Boolean) : [];
            const actions = Array.isArray(meta.recommended_actions) ? meta.recommended_actions.map(String).filter(Boolean) : [];
            return {
              heading: `${r.card_id} / ${r.severity} [${r.status}]`,
              body: [
                r.target_title ? `対象: ${r.target_title}` : `対象: ${r.target_type}:${r.target_id}`,
                checks.length > 0 ? `確認:\n${checks.map((v) => `・${v}`).join("\n")}` : "",
                actions.length > 0 ? `次アクション:\n${actions.map((v) => `・${v}`).join("\n")}` : "",
                `一致タグ: ${formatJsonCompact(r.matched_tags)}`,
              ].filter(Boolean).join("\n"),
              sub: [
                `match=${r.match_id}`,
                r.match_score != null ? `score=${Number(r.match_score).toFixed(2)}` : "",
                r.target_date ? `target=${formatJST(String(r.target_date))}` : "",
                r.due_at ? `due=${formatJST(String(r.due_at))}` : "",
                r.detected_at ? `detected=${formatJST(String(r.detected_at))}` : "",
              ].filter(Boolean).join(" · ") || undefined,
            };
          });
        }
        if (rows.length === 0) {
          rows = notificationFallbackRows(n);
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

  const restoreScrollAfterAnswer = (answeredKey: string) => {
    const answeredId = `notification-card-${answeredKey}`;
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[id^='notification-card-']"));
    const index = cards.findIndex((el) => el.id === answeredId);
    const fallbackEl = index >= 0 ? (cards[index + 1] ?? cards[index - 1] ?? null) : null;
    const fallbackKey = fallbackEl?.id.replace(/^notification-card-/, "") ?? null;
    const answeredEl = document.getElementById(answeredId);
    scrollRestoreRef.current = {
      primaryKey: answeredKey,
      fallbackKey,
      beforeTop: (answeredEl ?? fallbackEl)?.getBoundingClientRect().top ?? null,
      beforeScrollY: window.scrollY,
    };
  };

  const showAnsweredCardTemporarily = (answeredKey: string) => {
    const existingTimeout = answerHideTimeoutsRef.current[answeredKey];
    if (existingTimeout) window.clearTimeout(existingTimeout);

    setRecentlyAnsweredKeys((prev) => {
      const next = new Set(prev);
      next.add(answeredKey);
      return next;
    });

    answerHideTimeoutsRef.current[answeredKey] = window.setTimeout(() => {
      restoreScrollAfterAnswer(answeredKey);
      setRecentlyAnsweredKeys((prev) => {
        if (!prev.has(answeredKey)) return prev;
        const next = new Set(prev);
        next.delete(answeredKey);
        return next;
      });
      delete answerHideTimeoutsRef.current[answeredKey];
    }, ANSWERED_CARD_HIDE_MS);
  };

  useLayoutEffect(() => {
    const snapshot = scrollRestoreRef.current;
    if (!snapshot) return;
    scrollRestoreRef.current = null;

    const applyRestore = () => {
      const anchorEl = document.getElementById(`notification-card-${snapshot.primaryKey}`)
        ?? (snapshot.fallbackKey ? document.getElementById(`notification-card-${snapshot.fallbackKey}`) : null);
      if (anchorEl && snapshot.beforeTop != null) {
        const delta = anchorEl.getBoundingClientRect().top - snapshot.beforeTop;
        if (Math.abs(delta) > 1) window.scrollBy(0, delta);
        return;
      }
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, Math.min(snapshot.beforeScrollY, maxScrollY));
    };

    applyRestore();
    window.requestAnimationFrame(applyRestore);
  }, [answeredMap, localFeedbacks, recentlyAnsweredKeys]);

  useEffect(() => {
    return () => {
      Object.values(answerHideTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    if (!focusedKey || focusHandledKey === focusedKey) return;
    const focused = items.find((i) => itemKey(i) === focusedKey);
    if (!focused) return;
    setFocusHandledKey(focusedKey);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(focusedKey);
      return next;
    });
    if (!details[focusedKey]) {
      void loadDetails(focused);
    }
    if (!serverReadAt(focused)) {
      void markAsRead(focused);
    }
    window.setTimeout(() => {
      document.getElementById(`notification-card-${focusedKey}`)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }, 150);
  }, [details, focusedKey, focusHandledKey, items, loadDetails, markAsRead]);

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
      restoreScrollAfterAnswer(key);
      setLocalFeedbacks((prev) => [created.feedback as Feedback, ...prev]);
      setAnsweredMap((prev) => ({ ...prev, [key]: action }));
      showAnsweredCardTemporarily(key);
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
        const activeReviewItems = filtered.filter((i) => !isAnswered(i) || isRecentlyAnswered(i));
        const unreadItems = activeReviewItems.filter((i) => isRecentlyAnswered(i) || !isReadBucket(i));
        const readItems = activeReviewItems.filter((i) => !isRecentlyAnswered(i) && isReadBucket(i));
        const answeredItems = filtered.filter((i) => isAnswered(i));
        const displayNumberByKey = new Map(filtered.map((i, idx) => [itemKey(i), idx + 1]));

        const renderCard = (i: UnifiedItem) => {
          const key = itemKey(i);
          const displayNumber = displayNumberByKey.get(key);
          const isExpanded = expanded.has(key);
          const isSubmitting = submitting.has(key);
          const detail = details[key];
          const itemFeedbacks = findFeedbacksFor(i);
          const responseAction = responseActionFor(key, itemFeedbacks);
          const priority = unifiedItemPriority(i);
          const alreadySaved = isAlreadySavedForReview(i);
          const actionCopy = reviewActionCopyForItem(i, alreadySaved);
          const coverageGapCopyBlocked = isCoverageGapItem(i)
            && !isGovernanceCoverageGap(i.data as Notification)
            && coverageGapDetailBlocksCopy(detail);
          const actionPrompt = coverageGapCopyBlocked ? coverageGapBlockedPrompt(detail) : actionCopy.prompt;
          const actionFootnote = coverageGapCopyBlocked ? coverageGapBlockedFootnote(detail) : actionCopy.footnote;
          const yesLabel = coverageGapCopyBlocked ? coverageGapBlockedYesLabel(detail) : actionCopy.yesLabel;
          return (
            <div
              id={`notification-card-${key}`}
              key={key}
              className={`border rounded-lg overflow-hidden ${
                priority === "critical"
                  ? "border-red-300 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20"
                  : isReadUi(i)
                    ? "bg-card"
                    : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
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
                  <div className="flex items-start gap-2">
                    {displayNumber != null && (
                      <span
                        className="mt-0.5 shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground"
                        title="いま表示している一覧内の通し番号"
                      >
                        No.{displayNumber}
                      </span>
                    )}
                    <div className="font-medium text-sm leading-snug min-w-0">
                      <LinkedMemberText text={itemDisplayTitle(i)} />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatJST(i.data.created_at)} ・{" "}
                    <span className={`mr-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      priority === "critical"
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    }`}>
                      {notificationPriorityLabel(priority)}
                    </span>
                    {itemMetaLabel(i, projectMap)}
                    {!isReadUi(i) && <span className="ml-2 text-blue-600 dark:text-blue-400">● 未読</span>}
                    {(() => {
                      if (isCoverageGapItem(i)) return null;
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
                      {actionCopy.headlineLabel}: <LinkedMemberText text={isCoverageGapItem(i) ? coverageGapQuestionSummary(i.data) : i.data.summary || "(なし)"} />
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">
                      通知ヘッドライン: <LinkedMemberText text={i.data.summary_short || `[${i.data.source_kinds}]`} />
                    </div>
                  )}

                  {isCoverageGapItem(i) && isGovernanceCoverageGap(i.data as Notification) && (
                    <GovernanceActionContractPanel contract={governanceActionContract(i.data as Notification)} />
                  )}

                  {/* 実データ (lazy fetch) */}
                  <DetailSection detail={details[key]} title={detailTitleForItem(i)} />

                  {/* どこに何が反映されるかを、通知カード内でも先に明示する。 */}
                  {!(isCoverageGapItem(i) && isGovernanceCoverageGap(i.data as Notification)) && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                      <div className="font-medium text-slate-600 dark:text-slate-300">確認・反映先</div>
                      <div className="mt-1 text-blue-700 dark:text-blue-300">
                        {i.kind === "l2" ? <DeepLinkForL2 n={i.data} /> : <DeepLinkForMeeting n={i.data} />}
                      </div>
                      <div className="mt-2 font-medium text-slate-600 dark:text-slate-300">追加・更新する情報</div>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{i.kind === "l2" ? i.data.summary || "通知本文に記載の候補" : i.data.summary_short || "会議サマリの確認記録"}</p>
                      <div className="mt-2 font-medium text-slate-600 dark:text-slate-300">この操作の結果</div>
                      <p className="mt-1 text-slate-700 dark:text-slate-200">{actionFootnote}</p>
                    </div>
                  )}

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
                          <LinkedMemberText text={f.feedback_text} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 回答フォーム */}
                  <div className="border-t pt-3">
                    {responseAction ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-500/25 bg-emerald-500/8 px-3 py-2">
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          回答済み: {responseLabelForItem(responseAction, i, alreadySaved)}
                        </span>
                        {isSubmitting && <span className="text-[11px] text-muted-foreground">送信中...</span>}
                      </div>
                    ) : (
                      <>
                        <label className="text-xs font-medium block mb-1">回答・コメント</label>
                        <p className="mb-2 text-[11px] text-muted-foreground">
                          {actionPrompt}
                        </p>
                        <textarea
                          className="w-full text-sm border rounded p-2 min-h-[60px] bg-background"
                          placeholder={actionCopy.placeholder}
                          value={feedbackTexts[key] ?? ""}
                          onChange={(e) => setFeedbackTexts((prev) => ({ ...prev, [key]: e.target.value }))}
                          disabled={isSubmitting}
                        />
                        <div className="flex flex-wrap justify-end gap-2 mt-2">
                          <button
                            className="text-xs px-3 py-1.5 border border-emerald-500 text-emerald-700 rounded hover:bg-emerald-50 disabled:opacity-50"
                            onClick={() => submitFeedback(i, "yes")}
                            disabled={isSubmitting || coverageGapCopyBlocked}
                          >
                            {isSubmitting ? "送信中..." : yesLabel}
                          </button>
                          <button
                            className="text-xs px-3 py-1.5 border border-red-400 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
                            onClick={() => submitFeedback(i, "no")}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "送信中..." : actionCopy.noLabel}
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
                          {actionFootnote}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        };

        const renderPrioritySections = (bucketItems: UnifiedItem[], className = "space-y-4") => {
          const criticalItems = bucketItems.filter((i) => unifiedItemPriority(i) === "critical");
          const normalItems = bucketItems.filter((i) => unifiedItemPriority(i) === "normal");
          return (
            <div className={className}>
              {criticalItems.length > 0 && (
                <NotificationPrioritySection priority="critical" count={criticalItems.length}>
                  {criticalItems.map((i) => renderCard(i))}
                </NotificationPrioritySection>
              )}
              {normalItems.length > 0 && (
                <NotificationPrioritySection priority="normal" count={normalItems.length}>
                  {normalItems.map((i) => renderCard(i))}
                </NotificationPrioritySection>
              )}
            </div>
          );
        };

        return (
          <>
            {filter === "answered" && answeredItems.length > 0 && (
              renderPrioritySections(answeredItems)
            )}

            {/* 未読 */}
            {filter !== "answered" && unreadItems.length > 0 && (
              renderPrioritySections(unreadItems)
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
                  renderPrioritySections(readItems, "space-y-4 mt-2 opacity-80")
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

function NotificationPrioritySection({
  priority,
  count,
  children,
}: {
  priority: NotificationPriority;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`mb-2 flex items-center gap-2 text-xs font-semibold ${
        priority === "critical" ? "text-red-700 dark:text-red-300" : "text-muted-foreground"
      }`}>
        <span>{priority === "critical" ? "緊急性の高い通知" : "通常通知"}</span>
        <span className="font-mono text-[11px] opacity-70">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// 展開時の実データ表示セクション
function DetailSection({ detail, title = "抽出された内容" }: { detail: DetailRow | undefined; title?: string }) {
  if (!detail) return null;
  if (detail.loading) {
    return <div className="text-xs text-muted-foreground italic">📥 抽出された内容を読み込み中...</div>;
  }
  if (detail.error) {
    return <div className="text-xs text-red-500">読み込み失敗: {detail.error}</div>;
  }
  const rows = detail.rows ?? [];
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground italic">この通知に紐づく詳細行は表示できませんでした。通知本文と確認先を見て判断してね。</div>;
  }
  return (
    <div className="space-y-2 bg-muted/30 rounded p-2">
      <div className="text-xs font-medium text-muted-foreground">📦 {title} ({rows.length} 件)</div>
      {rows.map((r, idx) => (
        <div key={idx} className="border-l-2 border-primary/30 pl-2 py-0.5">
          <div className="text-sm font-medium">
            <LinkedMemberText text={r.heading} />
          </div>
          <div className="text-sm whitespace-pre-wrap text-foreground/80">
            <LinkedMemberText text={r.body} />
          </div>
          {r.sub && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              <LinkedMemberText text={r.sub} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GovernanceActionContractPanel({ contract }: { contract: GovernanceActionContract }) {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50/70 p-3 text-xs text-slate-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-slate-200">
      <div className="font-semibold text-blue-900 dark:text-blue-200">採用すると追加される内容</div>
      <div className="mt-2">
        <div className="font-medium text-slate-600 dark:text-slate-300">追加先</div>
        <Link href={contract.href} className="mt-0.5 inline-block text-blue-700 underline dark:text-blue-300">{contract.destination}</Link>
      </div>
      <div className="mt-2">
        <div className="font-medium text-slate-600 dark:text-slate-300">追加する情報</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {contract.changes.map((change, index) => <li key={index}>{change}</li>)}
        </ul>
      </div>
      <div className="mt-2">
        <div className="font-medium text-slate-600 dark:text-slate-300">採用すると起きること</div>
        <p className="mt-0.5 leading-5">{contract.approvalEffect}</p>
      </div>
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
    case "project_strategy_signal":
      return (
        <a className="text-blue-600 hover:underline" href={`/project/${n.target_id}/cockpit?ym=${notificationYm(n.scope_key)}`}>
          /project/{n.target_id}/cockpit (経営ハイライトを確認)
        </a>
      );
    case "textbook_insight": {
      const meta = objectValue(n.metadata_json);
      const slug = textFromUnknown(meta.target_bzm_slug) || "8-1-amd-os-operations";
      return (
        <a className="text-blue-600 hover:underline" href={`/bzm/${encodeURIComponent(slug)}`}>
          /bzm/{slug} (承認後に local applier が追記)
        </a>
      );
    }
    case "contract_signals":
      return (
        <a className="text-blue-600 hover:underline" href={`/admin/contracts`}>
          /admin/contracts (契約予兆・予定枠を確認)
        </a>
      );
    case "news_mention":
      return (
        <a className="text-blue-600 hover:underline" href={`/dashboard#company-content`}>
          /dashboard (Company Content のメディア掲載で確認)
        </a>
      );
    case "coverage_gap":
      if (isGovernanceCoverageGap(n)) {
        const contract = governanceActionContract(n);
        return <a className="text-blue-600 hover:underline" href={contract.href}>{contract.destination} を開く</a>;
      }
      return (
        <a className="text-blue-600 hover:underline" href={`/admin/coverage-gaps`}>
          確認一覧を開く
        </a>
      );
    case "guardrail_match":
      return (
        <span>
          <code className="text-xs bg-muted px-1 rounded">guardrail_matches</code> match_id=
          <code className="text-xs bg-muted px-1 rounded">{n.scope_key}</code>
        </span>
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
  project_config_gap: 0.1,
  project_registry_diff: 0.2,
  xrl_evidence: 2,
  project_strategy_signal: 1,
  textbook_insight: 1,
  contract_signals: 0,
  founding_members: 10,
  meeting_summary: 0.2,
  coverage_gap: 0.3,
  guardrail_match: 0,
};

function formatJsonCompact(value: unknown): string {
  try {
    const s = JSON.stringify(value ?? {}, null, 0);
    return s.length > 260 ? `${s.slice(0, 260)}...` : s;
  } catch {
    return String(value ?? "");
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textFromUnknown(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function truncateOneLine(value: string, limit = 360): string {
  const s = value.replace(/\s+/g, " ").trim();
  if (!s) return "(snippetなし)";
  return s.length > limit ? `${s.slice(0, limit)}...` : s;
}

function textbookSourceLabel(table: string): string {
  const key = table.trim().toLowerCase();
  const labels: Record<string, string> = {
    protocols: "AMDプロトコル",
    protocol_examples: "AMDプロトコルの事例",
    protocol_result_observations: "AMDプロトコルの後追い結果",
    project_meeting_summaries: "会議要約",
    project_strategy_signals: "重要メモ",
    project_knowledge: "PJナレッジ",
    monthly_reports: "月次レポート",
  };
  return labels[key] ?? table;
}

function textbookSourceSummary(sourceTables: string[], refs: unknown[]): string {
  const labels = sourceTables.length > 0
    ? Array.from(new Set(sourceTables.map(textbookSourceLabel)))
    : ["AMD OS内の記録"];
  const evidenceTitles = refs
    .map((entry) => objectValue(entry))
    .map((ref) => textFromUnknown(ref.title) || textFromUnknown(ref.summary) || textFromUnknown(ref.snippet))
    .filter(Boolean)
    .map((v) => truncateOneLine(v, 120));
  const firstTitle = evidenceTitles[0];
  const base = `${labels.join("・")}に残っていた記録から抽出。`;
  if (!firstTitle) return base;
  return `${base}\n根拠の見出し: ${firstTitle}`;
}

function textbookPracticeKindLabel(practiceKind: string): string {
  const labels: Record<string, string> = {
    decision_branch: "現場判断と分岐",
    failure_learning: "失敗・手戻りからの学び",
    cross_project_pattern: "PJ横断パターン",
    theory_case: "BZM理論の検証ケース",
    reusable_question: "次回も使える問い",
    relationship_playbook: "関係構築プレイブック",
    field_transition: "研究現場から事業化への移行",
  };
  return labels[practiceKind] ?? (practiceKind || "実践知");
}

function textbookAppendTargetText(slug: string, section: string, practiceKind: string): string {
  const target = slug ? `/bzm/${slug}` : "BZMの該当章";
  const sectionText = section || textbookPracticeKindLabel(practiceKind);
  if (practiceKind === "decision_branch") {
    return `${target} / ${sectionText}\n「分岐点」はAMDプロトコル本文の疑問文ではなく、BZM側で“判断の条件・材料・結果を再利用可能に残す”ための分類。`;
  }
  return `${target} / ${sectionText}`;
}

function cleanTextbookBodyMarkdown(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^結果\s+null\s*$/gim, "")
    .replace(/^null\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textbookDecisionGuide(insightType: string, priority: number, practiceKind: string, sourceTables: string[]): string {
  const kindLabel = textbookPracticeKindLabel(practiceKind);
  const sourceHasProtocol = sourceTables.map((v) => v.toLowerCase()).includes("protocols");
  const typeText = insightType === "before_zero_knowhow"
    ? "Before Zeroで再利用できる経営判断・失敗回避の知見"
    : "PJ横断で再利用できる知見";
  const priorityText = priority === 1 ? "優先度は高め。" : "優先度は中程度。";
  const protocolText = sourceHasProtocol
    ? "元ネタがAMDプロトコルなので、単なるSX固有メモではなく“次のPJでも使える判断パターン”に抽象化できているかを見る。"
    : "元記録が特定PJに寄りすぎていないか、次のPJでも使える言い方になっているかを見る。";
  return `${priorityText}${typeText}として、分類は「${kindLabel}」。${protocolText}`;
}

function textbookProtocolRelationship(sourceTables: string[], practiceKind: string): string {
  const sourceHasProtocol = sourceTables.map((v) => v.toLowerCase()).includes("protocols");
  if (!sourceHasProtocol) {
    return "この候補はAMDプロトコルの書き換えではない。元記録からBZM向きの学びだけを抜き出す候補。";
  }
  if (practiceKind === "decision_branch") {
    return "元ネタはAMDプロトコル。追記先はBZM。AMDプロトコルにある「分岐点 / 判断材料 / アクション」を、Before Zeroの教材として再利用できる判断パターンに変換する候補。AMDプロトコル本文は書き換えない。";
  }
  return "元ネタはAMDプロトコル。追記先はBZM。元ネタと追記先が違うので、AMDプロトコル本文は書き換えない。";
}

function textbookCandidateStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    candidate: "未判断",
    approved: "承認済み",
    rejected: "不採用",
    applied: "BZMへ追記済み",
  };
  return labels[status] ?? (status || "未判断");
}

function textbookReviewGateText(reviewRequired: boolean, reviewStatus: string, theoryScope: string): string {
  if (reviewRequired) {
    return `BZM理論レビュー: ${reviewStatus || "未完了"}`;
  }
  if (theoryScope && theoryScope !== "none") {
    return `理論変更範囲: ${theoryScope}`;
  }
  return "BZM理論レビュー: 不要";
}

function stripNotificationPrefix(title: string): string {
  return title
    .replace(/^D-\d+\s*[^:：]*[:：]\s*/, "")
    .trim();
}

function normalizeCoverageTarget(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "project_strategy_signal") return "strategy_signal";
  if (v === "registry_diff" || v === "project_registry_diff") return "registry_diff";
  if (["shareholder_meeting", "governance", "project_shareholder_meeting"].includes(v)) return "shareholder_meeting";
  return v;
}

function coverageGapSubjectFromTitle(raw: string | null | undefined): string {
  let s = stripNotificationPrefix(sanitizeMeetingTitle(raw ?? ""));
  s = s
    .replace(/^未OS化(?:の可能性|候補)?[:：]\s*/, "")
    .replace(/^(?:D-6\s*)?経営ハイライトに残す[？?][:：]\s*/, "")
    .replace(/^重要メモに残す[？?][:：]\s*/, "")
    .replace(/^重要メモにコピーする[？?][:：]\s*/, "")
    .replace(/^OSに残す[？?][:：]\s*/, "")
    .replace(/\s*\/\s*(?:【web】\s*)?.*(?:経営会議|会議|審査委員会|委員会)\s*$/, "")
    .trim();

  const h1Match = s.match(/^H-1\s*要約で(.+?)が(?:薄まった|弱まった)可能性[:：]\s*(.+)$/);
  if (h1Match) {
    return humanizeCoverageSubject(h1Match[1].trim());
  }
  return humanizeCoverageSubject(s || "(no title)");
}

function coverageGapQuestionTitle(n: Notification): string {
  if (isGovernanceCoverageGap(n)) {
    const headline = textFromUnknown(objectValue(n.metadata_json).meeting_name) || coverageGapSubjectFromTitle(n.title);
    return `開催履歴を追加する？: ${headline}`;
  }
  const subject = coverageGapQuestionSubject(n);
  if (coverageGapNotificationNeedsSourceRecovery(n)) {
    return `コピー前に元情報を確認: ${subject}`;
  }
  return `重要メモにコピーする？: ${subject}`;
}

function coverageGapQuestionSubject(n: Notification): string {
  const summary = n.summary ?? "";
  if (/VC\s*3社|VC3社/.test(summary) && /PoC|NEDO/.test(summary)) {
    return "PoC後にVC3社が出資を検討するかも";
  }
  const fromTitle = coverageGapSubjectFromTitle(n.title || n.summary);
  const fromSummary = coverageGapSubjectFromSummary(summary);
  if (coverageGapSubjectLooksGeneric(fromTitle) && fromSummary) return fromSummary;
  return fromTitle;
}

function coverageGapQuestionSummary(n: Notification): string {
  if (isGovernanceCoverageGap(n)) {
    return "この候補は、メールや資料から見つけた開催情報の下書き。採用するまで会社概要の開催履歴には追加されない。追加先と追加する情報を確認してから判断してね。";
  }
  const subject = coverageGapQuestionSubject(n);
  if (coverageGapNotificationNeedsSourceRecovery(n)) {
    return `この通知は「${subject}」を重要メモ候補として出しているが、具体的な会議メモ本文がこのカードだけでは確認できない。内容を確認できるまで、重要メモへのコピー判断はしない。`;
  }
  if (subject.includes("VC3社")) {
    return "下の「コピーされる文章」を、保存済みの会議要約とは別に、重要メモへコピーするかの確認。元の会議要約は書き換えない。";
  }
  return `下の「コピーされる文章」を、保存済みの会議要約とは別に、重要メモへコピーするかの確認。コピー候補の主題: ${subject}。元の会議要約は書き換えない。`;
}

function coverageGapActionCopy(n: Notification): ReviewActionCopy {
  const meta = objectValue(n.metadata_json);
  const target = normalizeCoverageTarget(textFromUnknown(meta.proposed_target_l2));
  if (target === "shareholder_meeting") {
    const contract = governanceActionContract(n);
    return {
      yesLabel: contract.approvalLabel,
      noLabel: contract.rejectionLabel,
      yesDoneLabel: "開催履歴を追加済み",
      noDoneLabel: "追加しないで完了",
      prompt: `「${contract.approvalLabel}」で、${contract.destination}に表示された開催履歴を1件追加する。`,
      footnote: `${contract.approvalEffect} ${contract.rejectionEffect}`,
      placeholder: "任意コメント。例: 議題を短くして / 決議内容を確認してから追加したい",
      headlineLabel: "何をする通知？",
    };
  }
  if (target === "strategy_signal") {
    return {
      yesLabel: "重要メモにコピー",
      noLabel: "コピーしない",
      yesDoneLabel: "重要メモにコピー済み",
      noDoneLabel: "コピーしないで完了",
      prompt: "上の「コピーされる文章」を重要メモに残すかだけを選ぶ。コピーしても元の会議要約は書き換えない。",
      footnote: "コピーしても出資決定・正式合意・着金合意としては扱わない。元の会議要約を直したい場合はコメントに書く。",
      placeholder: "任意コメント。例: この文章なら残す / 元の要約も直したい / これはコピーしない",
      headlineLabel: "確認したいこと",
    };
  }
  return {
    yesLabel: "重要メモにコピー",
    noLabel: "コピーしない",
    yesDoneLabel: "重要メモにコピー済み",
    noDoneLabel: "コピーしないで完了",
    prompt: "上の「コピーされる文章」を重要メモに残すかだけを選ぶ。コピーしても元の会議要約は書き換えない。",
    footnote: "コピーしても正式決定としては扱わない。元の会議要約を直したい場合はコメントに書く。",
    placeholder: "任意コメント。例: この文章なら残す / 元の要約も直したい / これはコピーしない",
    headlineLabel: "確認したいこと",
  };
}

function humanizeCoverageSubject(value: string): string {
  let s = value.replace(/\s+/g, " ").trim();
  s = s
    .replace(/PoC後のVC関心確認/g, "PoC後にVCが出資を検討する話")
    .replace(/VC関心確認/g, "VCが出資を検討する話")
    .replace(/創業体制\/資金調達転換/g, "創業体制や資金調達方針の変化")
    .replace(/合金キャピタル新株予約権の具体条件/g, "合金キャピタルの新株予約権の条件")
    .replace(/条件付き投資家関心/g, "条件がそろえば出資を検討する話")
    .replace(/条件付き情報/g, "条件つきの話")
    .replace(/薄い/g, "弱く書かれている");
  return truncateOneLine(s, 80);
}

function humanizeCoverageSentence(value: string): string {
  let s = value.replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (/VC\s*3社|VC3社/.test(s) && /PoC|NEDO/.test(s)) {
    if (/資本政策|CEO持株比率/.test(s) && /薄い|目立たない|中心/.test(s)) {
      return "保存済みの会議要約では、資本政策やCEO持株比率の話が中心で、VC3社の出資検討の話が入っていないか、弱く書かれている可能性がある。";
    }
    return "PoCが終わったあとなら、VC3社が出資を検討するかもしれない。まだ出資決定ではないので、期待しすぎない形で残す必要がある。";
  }
  s = s
    .replace(/raw transcript/g, "会議メモ")
    .replace(/Notion文字起こし/g, "会議メモ")
    .replace(/Drive資料/g, "資料")
    .replace(/H-1保存結果/g, "保存済みの会議要約")
    .replace(/H-1要約/g, "保存済みの会議要約")
    .replace(/条件付き投資家関心/g, "条件がそろえば出資を検討する話")
    .replace(/条件付き情報/g, "条件つきの話")
    .replace(/目立たない\/欠落している可能性がある/g, "入っていないか、弱く書かれている可能性がある")
    .replace(/目立たない/g, "弱く書かれている")
    .replace(/薄い/g, "弱く書かれている")
    .replace(/参画・リード投資家・出資決定・着金合意ではない前提で要確認/g, "まだ正式な出資決定ではないので、期待しすぎない形で残す");
  return truncateOneLine(s, 220);
}

function coverageGapProjectLabel(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  const prefix = text.match(/^([A-Za-z0-9]{2,8}|[Ａ-ＺA-Z]{2,8})[）)]\s*(?:int|定例|MTG|会議)?/);
  if (prefix?.[1]) return prefix[1].replace(/[Ａ-Ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  return "";
}

function normalizeCoverageMemoTopic(value: string): string {
  const cleaned = value
    .replace(/投資家向け資金調達文脈/g, "投資家向けの資金調達方針")
    .replace(/資金調達文脈/g, "資金調達方針")
    .replace(/CEO\/代表/g, "CEO・代表")
    .replace(/CEO体制/g, "CEO体制")
    .replace(/\s+/g, "")
    .trim();
  const parts = cleaned.split(/[・、,／/]+/).map((v) => v.trim()).filter(Boolean);
  if (parts.length === 0) return cleaned;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}と${parts[1]}`;
  return `${parts.slice(0, -1).join("、")}、${parts[parts.length - 1]}`;
}

function normalizeCoverageMemoCurrentFocus(value: string): string {
  return value
    .replace(/H-1本文/g, "会議要約")
    .replace(/H-1要約/g, "会議要約")
    .replace(/PoC探索/g, "PoC探索")
    .replace(/\s+/g, "")
    .trim();
}

function stripCoverageAuditBoilerplate(value: string): string {
  return value
    .replace(/本文は自動上書きせず、人間確認候補として残す。?/g, "")
    .replace(/会社として決定済み扱いにはせず、?/g, "")
    .replace(/参画・リード投資家・出資決定・着金合意ではない前提で要確認。?/g, "")
    .replace(/正式決定ではない前提で要確認。?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function coverageGapMemoFromAuditPattern(value: string): string {
  const text = stripCoverageAuditBoilerplate(value);
  const patterns = [
    /^(.+?)の元ソースには(.+?)も出ているが、保存済みH-1本文では主に(.+?)(?:へ|に)寄っている可能性がある。?$/,
    /^(.+?)の元ソースには(.+?)も出ているが、保存済みの会議要約では主に(.+?)(?:へ|に)寄っている可能性がある。?$/,
    /^(.+?)には(.+?)も出ているが、保存済みH-1本文では主に(.+?)(?:へ|に)寄っている可能性がある。?$/,
    /^(.+?)には(.+?)も出ているが、保存済みの会議要約では主に(.+?)(?:へ|に)寄っている可能性がある。?$/,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const project = coverageGapProjectLabel(m[1]) || "この会議";
    const topic = normalizeCoverageMemoTopic(m[2]);
    const currentFocus = normalizeCoverageMemoCurrentFocus(m[3]);
    const subject = project === "この会議" ? "この会議では" : `${project}の会議では`;
    return `${subject}、${topic}も論点に出ていた。保存済みの会議要約では${currentFocus}が中心なので、この経営論点を重要メモとして別枠で残す。`;
  }
  return "";
}

function coverageGapCopyMemo(summary: string, evidence: Record<string, unknown>, title: string): string {
  const rawCandidates = [
    textFromUnknown(evidence.copy_memo),
    textFromUnknown(evidence.proposed_memo),
    summary,
    textFromUnknown(evidence.raw_signal),
    textFromUnknown(evidence.original_signal),
    textFromUnknown(evidence.summary),
    title,
  ].filter(Boolean);
  for (const candidate of rawCandidates) {
    const auditMemo = coverageGapMemoFromAuditPattern(candidate);
    if (auditMemo) return auditMemo;
  }
  const raw = rawCandidates[0] || "";
  if (/VC\s*3社|VC3社/.test(raw) && /PoC|NEDO/.test(raw)) {
    return "PoCやNEDO確認のあとに、VC3社が出資を検討する可能性がある。まだ出資決定ではないので、要確認の投資家関心として重要メモに残す。";
  }
  const original = coverageGapOriginalSignal(summary, evidence);
  const sentence = stripCoverageAuditBoilerplate(original || raw);
  if (!sentence || sentence === "(snippetなし)") {
    return "会議メモで見つかった経営論点を、正式決定ではなく要確認の重要メモとして別枠で残す。";
  }
  if (/可能性がある$/.test(sentence)) {
    return `${sentence}ため、正式決定ではなく要確認の重要メモとして別枠で残す。`;
  }
  return `${sentence.replace(/。?$/, "")}。正式決定ではなく要確認の重要メモとして別枠で残す。`;
}

function coverageGapManagementTerms(value: string): string[] {
  const terms: string[] = [];
  const checks: Array<[RegExp, string]> = [
    [/CEO|代表|創業体制|就任|体制/, "CEO体制"],
    [/資金調達|投資家|VC|出資|リード投資家/, "資金調達・投資家"],
    [/資本政策|持株|株式|新株予約権|SO|cap table/i, "資本政策"],
    [/契約|合意|MOU|NDA|共同開発/, "契約・合意"],
    [/PoC|実証|採択|補助金|NEDO/, "PoC・実証"],
  ];
  for (const [regex, label] of checks) {
    if (regex.test(value) && !terms.includes(label)) terms.push(label);
  }
  return terms;
}

function coverageGapDecisionGuide(copyMemo: string, summary: string): string {
  const terms = coverageGapManagementTerms(`${copyMemo}\n${summary}`);
  if (terms.length > 0) {
    return `残す寄り。${terms.slice(0, 3).join(" / ")}は後から経営判断で確認したくなる論点なので、正式決定ではなく「要確認の重要メモ」として残す価値がある。`;
  }
  return "迷ったらコピーしない寄り。後で経営判断に使う具体的な論点が見えないなら、重要メモへ増やさない。";
}

function coverageGapSubjectFromSummary(summary: string | null | undefined): string {
  const text = String(summary ?? "")
    .replace(/H-1\s*保存済み[。.\s]*/g, "")
    .replace(/D-6/g, "重要メモ")
    .trim();
  const promotion = text.match(/(.+?)の重要メモ\s*昇格を確認/);
  if (promotion?.[1]) {
    return humanizeCoverageSubject(`${promotion[1].trim()}の話`);
  }
  if (/資金調達|創業体制/.test(text)) return "資金調達・創業体制の話";
  if (/資本政策|CEO持株比率|持株/.test(text)) return "資本政策・持株比率の話";
  if (/VC\s*3社|VC3社|PoC|NEDO/.test(text)) return "PoC後にVC3社が出資を検討するかも";
  return "";
}

function coverageGapSubjectLooksGeneric(subject: string): boolean {
  const s = String(subject ?? "").replace(/\s+/g, "");
  if (!s) return true;
  if (/^(?:CX定例の)?経営判断を要確認$/.test(s)) return true;
  if (/^(?:会議メモの)?確認$/.test(s)) return true;
  if (/要確認/.test(s) && !/(資金調達|創業体制|資本政策|持株|CEO|代表|VC|PoC|NEDO|新株予約権|合金)/.test(s)) return true;
  return false;
}

function coverageGapNotificationNeedsSourceRecovery(n: Notification): boolean {
  const titleSubject = coverageGapSubjectFromTitle(n.title || "");
  const text = `${n.title ?? ""}\n${n.summary ?? ""}`;
  return coverageGapSubjectLooksGeneric(titleSubject)
    || /H-1\s*保存済み/.test(text)
    || /D-6\s*昇格を確認/.test(text)
    || /対応する正本行の詳細表示/.test(text)
    || /通知本文と下の確認先を見て判断/.test(text);
}

function extractBetween(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start);
  if (startIndex < 0) return "";
  const from = startIndex + start.length;
  const endIndex = text.indexOf(end, from);
  return (endIndex >= 0 ? text.slice(from, endIndex) : text.slice(from)).trim();
}

function coverageGapOriginalSignal(summary: string, evidence: Record<string, unknown>): string {
  const fromSummary =
    extractBetween(summary, "raw transcriptとDrive資料には", "。一方")
    || extractBetween(summary, "raw transcriptとDrive資料には", "。")
    || extractBetween(summary, "会議メモと資料には", "。一方")
    || extractBetween(summary, "会議メモと資料には", "。")
    || extractBetween(summary, "raw transcriptには", "が出ているが")
    || extractBetween(summary, "Notion文字起こしには", "が出ているが")
    || extractBetween(summary, "元情報には", "が出ているが")
    || extractBetween(summary, "元データには", "が出ているが");
  const fromEvidence =
    textFromUnknown(evidence.raw_signal)
    || textFromUnknown(evidence.original_signal)
    || textFromUnknown(evidence.source_excerpt)
    || textFromUnknown(evidence.snippet)
    || textFromUnknown(evidence.summary);
  return humanizeCoverageSentence(fromSummary || fromEvidence || summary || "(会議メモの要約なし)");
}

function coverageGapCopyNonConsequence(targetValue: string): string {
  switch (normalizeCoverageTarget(targetValue)) {
    case "strategy_signal":
      return "元の会議要約は直さない。会社の正式決定、出資合意、着金合意としても扱わない。";
    case "action_item":
      return "元の会議要約は直さない。このボタンだけで担当者つきの要対応リストは作らない。";
    case "registry_diff":
      return "元の会議要約は直さない。このボタンだけでPJ台帳や契約台帳は書き換えない。";
    case "shareholder_meeting":
      return "元の会議要約は直さない。このボタンだけで株主・ガバナンス台帳は書き換えない。";
    default:
      return "元の会議要約は直さない。会社の正式決定としても扱わない。";
  }
}

function coverageGapUnavailableRows(n: Notification): NonNullable<DetailRow["rows"]> {
  const subject = coverageGapQuestionSubject(n);
  const clue = coverageGapUnavailableClue(n);
  return [
    {
      heading: COVERAGE_GAP_UNAVAILABLE_HEADING,
      body: [
        "元の確認候補が見つからないため、会議メモの具体的な内容をこの画面に表示できていない。",
        clue ? `残っている手がかり:\n${clue}` : "",
        "今できる判断:\n内容を確認できないなら「コピーしない」。元情報から確認し直したい場合は、コメントに「元情報を再確認」と書いて送る。",
        "重要メモにコピーしてよい条件:\n確認一覧や会議メモで、実際に残したい内容を自分で確認できている場合だけ。",
      ].filter(Boolean).join("\n\n"),
      sub: subject ? `候補: ${subject}` : "候補の具体内容を確認できていない",
    },
  ];
}

function coverageGapUnavailableClue(n: Notification): string {
  const clues: string[] = [];
  const subject = coverageGapQuestionSubject(n);
  if (subject && !coverageGapSubjectLooksGeneric(subject)) {
    clues.push(`候補名: ${subject}`);
  }
  const summarySubject = coverageGapSubjectFromSummary(n.summary);
  if (summarySubject && summarySubject !== subject) {
    clues.push(`通知本文の手がかり: ${summarySubject}`);
  }
  return clues.map((v) => `・${v}`).join("\n");
}

function coverageGapDetailBlocksCopy(detail: DetailRow | undefined): boolean {
  if (!detail) return true;
  if (detail.loading) return true;
  if (detail.error) return true;
  return (detail.rows ?? []).some((row) => row.heading === COVERAGE_GAP_UNAVAILABLE_HEADING);
}

function coverageGapBlockedPrompt(detail: DetailRow | undefined): string {
  if (!detail || detail.loading) return "コピー対象の具体内容を確認中。内容が表示されるまで、重要メモへのコピー判断は止める。";
  if (detail.error) return "コピー対象の具体内容を読み込めていない。内容が分からない場合は「コピーしない」。元情報から確認し直したい場合は、コメントに「元情報を再確認」と書いて送る。";
  return "このカードだけではコピー対象を判断できない。内容が分からない場合は「コピーしない」。元情報から確認し直したい場合は、コメントに「元情報を再確認」と書いて送る。";
}

function coverageGapBlockedFootnote(detail: DetailRow | undefined): string {
  if (!detail || detail.loading) return "具体内容を読み込み中。コピーはまだできない。";
  return "内容不足のまま重要メモへコピーしない。元の会議要約も、この操作では書き換えない。";
}

function coverageGapBlockedYesLabel(detail: DetailRow | undefined): string {
  if (!detail || detail.loading) return "内容を確認中";
  return "内容不足でコピー不可";
}

function notificationFallbackRows(n: Notification): NonNullable<DetailRow["rows"]> {
  if (n.l2_kind === "coverage_gap") {
    return coverageGapUnavailableRows(n);
  }
  const meta = objectValue(n.metadata_json);
  const metaBits = [
    textFromUnknown(meta.occurred_on) ? `date=${textFromUnknown(meta.occurred_on)}` : "",
    textFromUnknown(meta.media_name) ? `media=${textFromUnknown(meta.media_name)}` : "",
    textFromUnknown(meta.source_url) ? `url=${textFromUnknown(meta.source_url)}` : "",
  ].filter(Boolean);
  return [
    {
      heading: `${l2KindLabel(n.l2_kind)} [通知本文]`,
      body: [
        n.summary || "(summaryなし)",
        "この通知種別は、対応する正本行の詳細表示がまだ個別実装されていないか、通知作成後に候補行が移動/統合されている可能性がある。通知本文と下の確認先を見て判断してね。",
      ].join("\n"),
      sub: [n.scope_key ? `scope=${n.scope_key}` : "", ...metaBits].filter(Boolean).join(" · ") || undefined,
    },
  ];
}

function rawDataGapEvidenceRows(n: Notification): NonNullable<DetailRow["rows"]> {
  const meta = objectValue(n.metadata_json);
  const refs = Array.isArray(meta.evidence_refs) ? meta.evidence_refs : [];
  return refs.map((raw) => {
    const ref = objectValue(raw);
    const source = textFromUnknown(ref.source) || "source";
    const title = textFromUnknown(ref.title) || textFromUnknown(ref.url) || textFromUnknown(ref.id) || "(no title)";
    const snippet = textFromUnknown(ref.snippet) || textFromUnknown(ref.summary);
    const url = textFromUnknown(ref.url) || textFromUnknown(ref.source_url);
    const date = textFromUnknown(ref.date) || textFromUnknown(ref.item_date);
    const id = textFromUnknown(ref.id) || textFromUnknown(ref.item_id);
    return {
      heading: `${source.toUpperCase()}: ${title}`,
      body: truncateOneLine(snippet),
      sub: [date, url ? `url=${url}` : "", id ? `id=${id}` : ""].filter(Boolean).join(" · ") || undefined,
    };
  });
}

async function rawDataGapIngestedMeetingRows(
  supabase: ReturnType<typeof createClient>,
  n: Notification
): Promise<NonNullable<DetailRow["rows"]>> {
  if (!n.scope_key.includes("meeting-not-ingested")) return [];
  const meta = objectValue(n.metadata_json);
  const refs = Array.isArray(meta.evidence_refs) ? meta.evidence_refs : [];
  const meetingIds = Array.from(new Set(
    refs
      .map((raw) => {
        const ref = objectValue(raw);
        return textFromUnknown(ref.source_id) || textFromUnknown(ref.id);
      })
      .filter(Boolean)
  ));
  const dates = Array.from(new Set(
    refs
      .map((raw) => textFromUnknown(objectValue(raw).date).slice(0, 10))
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
  ));

  let rows: Array<{
    meeting_id: string;
    meeting_date: string;
    title: string | null;
    summary_short: string | null;
    source_kinds: string | null;
    updated_at: string | null;
  }> = [];

  if (meetingIds.length > 0) {
    const { data, error } = await supabase
      .from("project_meeting_summaries")
      .select("meeting_id, meeting_date, title, summary_short, source_kinds, updated_at")
      .eq("project_id", n.target_id)
      .in("meeting_id", meetingIds)
      .limit(5);
    if (error) throw error;
    rows = data ?? [];
  }

  if (rows.length === 0 && dates.length > 0) {
    const { data, error } = await supabase
      .from("project_meeting_summaries")
      .select("meeting_id, meeting_date, title, summary_short, source_kinds, updated_at")
      .eq("project_id", n.target_id)
      .in("meeting_date", dates)
      .limit(5);
    if (error) throw error;
    rows = data ?? [];
  }

  return rows.map((row) => ({
    heading: `OS取り込み済み: ${sanitizeMeetingTitle(row.title) || row.meeting_id}`,
    body: row.summary_short || "(summaryなし)",
    sub: [
      row.meeting_date,
      row.source_kinds ? `source=${row.source_kinds}` : "",
      row.updated_at ? `updated=${formatJST(row.updated_at)}` : "",
      `meeting_id=${row.meeting_id}`,
    ].filter(Boolean).join(" · "),
  }));
}

function xrlRowMatchesHash(row: unknown, hash: string): boolean {
  const r = objectValue(row);
  if (textFromUnknown(r.source_hash) === hash) return true;
  const refs = Array.isArray(r.source_refs_json) ? r.source_refs_json : [];
  return refs.some((raw) => {
    const ref = objectValue(raw);
    return textFromUnknown(ref.hash) === hash || textFromUnknown(ref.source_hash) === hash;
  });
}

function xrlNotificationFallbackRows(n: Notification): NonNullable<DetailRow["rows"]> {
  const meta = objectValue(n.metadata_json);
  const axis = textFromUnknown(meta.axis).toUpperCase() || "XRL";
  const evidenceKind = textFromUnknown(meta.evidence_kind) || "evidence";
  const sourceHash = textFromUnknown(meta.evidence_source_hash);
  return [
    {
      heading: `${axis} / ${evidenceKind} [通知のみ]`,
      body: [
        n.summary || "(summaryなし)",
        "候補本文は通知にあるけど、対応する project_xrl_evidence 行が見つかってない。生成側が通知だけ作った可能性がある。",
      ].join("\n"),
      sub: [sourceHash ? `source_hash=${sourceHash.slice(0, 12)}` : "", `scope=${n.scope_key}`].filter(Boolean).join(" · "),
    },
  ];
}

function strategySignalRowMatchesHash(row: unknown, hash: string): boolean {
  const r = objectValue(row);
  if (textFromUnknown(r.source_hash) === hash) return true;
  const refs = Array.isArray(r.source_refs_json) ? r.source_refs_json : [];
  return refs.some((raw) => {
    const ref = objectValue(raw);
    return textFromUnknown(ref.hash) === hash || textFromUnknown(ref.source_hash) === hash;
  });
}

function strategySignalNotificationFallbackRows(n: Notification): NonNullable<DetailRow["rows"]> {
  const meta = objectValue(n.metadata_json);
  const signalType = textFromUnknown(meta.signal_type) || "project_strategy_signal";
  const sourceHash = textFromUnknown(meta.signal_source_hash);
  return [
    {
      heading: `${signalType} [通知のみ]`,
      body: [
        n.summary || "(summaryなし)",
        "候補本文は通知にあるけど、対応する project_strategy_signals 行が見つかってない。生成側が通知だけ作った可能性がある。",
      ].join("\n"),
      sub: [sourceHash ? `source_hash=${sourceHash.slice(0, 12)}` : "", `scope=${n.scope_key}`].filter(Boolean).join(" · "),
    },
  ];
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
