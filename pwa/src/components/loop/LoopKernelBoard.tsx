"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * LoopKernelBoard — 5 段ループカーネル盤面 (経営レンズ)
 *
 * 仕様正本: pwa/spec/2-4-loop-kernel-role-lenses-plan.md
 * 観測→評価→判断→実行→学習の各段アイテムをクリック → 詳細モーダル (ページ遷移なし)。
 * 判断段はモーダル内で採否まで完結する (signals → /api/strategy-signals、
 * L2 通知 → /api/notifications/feedback + read_at 既読化)。
 * /loop と dashboard 最上段の両方から使う。admin 以外には何も出さない (self-gating)。
 */

type Stage = "observe" | "assess" | "decide" | "act" | "learn";

type DecisionTarget =
  | { type: "signal"; signalId: string }
  | { type: "l2"; notificationId: string; l2Kind: string; targetId: string; scopeKey: string };

type Field = { label: string; value: string };

type LoopItem = {
  id: string;
  stage: Stage;
  chip: string;
  chipTone?: string;
  listText: string;
  modalTitle: string;
  body: string | null;
  fields: Field[];
  decision?: DecisionTarget;
};

type BoardData = {
  observeCount: number;
  observeItems: LoopItem[];
  assessCount: number;
  assessItems: LoopItem[];
  assessXrlCount: number;
  decideCount: number;
  decideItems: LoopItem[];
  actCount: number;
  actRedCount: number;
  actItems: LoopItem[];
  learnCount: number;
  learnItems: LoopItem[];
  protocolCount: number;
  textbookCount: number;
};

const IMPACT_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// 正本は NotificationsClient.tsx の L2_KIND_LABEL (同一マップ)。共有 lib 化は Step 2 以降で検討
const L2_KIND_LABEL: Record<string, string> = {
  protocols: "D-1 AMDプロトコル",
  ms_progress: "D-2 MS進捗",
  ms_progress_revision: "D-2 MS進捗修正提案",
  project_knowledge: "D-3 PJナレッジ",
  member_knowledge: "D-4 メンバーナレッジ",
  meeting_summary: "H-1 MTGサマリ",
  project_registry_diff: "D-5 OS台帳差分",
  project_member_candidate: "D-5 OS台帳差分",
  project_contact_candidate: "D-5 OS台帳差分",
  raw_data_gap: "D-5 OS台帳差分",
  project_config_gap: "D-5 OS台帳差分",
  xrl_evidence: "M-2 XRL根拠",
  founding_members: "M-2 XRL根拠",
  project_strategy_signal: "D-6 経営ハイライト",
  textbook_insight: "D-7 Textbook Insights",
  contract_signals: "D-13 契約予兆",
  news_mention: "D-11 メディア掲載",
};

const IMPACT_TONE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-500",
  high: "bg-amber-500/15 text-amber-600",
};

function jstTodayStartIso(): string {
  const jstNow = new Date(Date.now() + 9 * 3600_000);
  const startUtcMs =
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - 9 * 3600_000;
  return new Date(startUtcMs).toISOString();
}

function dueChip(dueAt: string | null): { label: string; tone: string } {
  if (!dueAt) return { label: "期限なし", tone: "bg-muted text-muted-foreground" };
  const remainMs = new Date(dueAt).getTime() - Date.now();
  const remainH = Math.round(remainMs / 3600_000);
  if (remainMs < 0) return { label: `超過${Math.abs(remainH)}h`, tone: "bg-red-500/15 text-red-500" };
  if (remainH <= 24) return { label: `残${remainH}h`, tone: "bg-red-500/15 text-red-500" };
  if (remainH <= 72) return { label: `残${remainH}h`, tone: "bg-amber-500/15 text-amber-600" };
  return { label: `残${Math.round(remainH / 24)}日`, tone: "bg-muted text-muted-foreground" };
}

function formatJst(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function str(value: unknown): string {
  return value == null ? "" : String(value);
}

const BODY_MAX_CHARS = 4000;

function clampBody(text: string | null): string | null {
  if (!text) return null;
  return text.length > BODY_MAX_CHARS ? `${text.slice(0, BODY_MAX_CHARS)}\n…(以下省略)` : text;
}

type LoopKernelBoardProps = {
  /** dashboard 埋め込み用: 非 admin / 読み込み失敗時に枠ごと消す */
  hideWhenNoAccess?: boolean;
  /** dashboard 埋め込み用: 小見出しを出す (/loop はページ側にヘッダがある) */
  showHeader?: boolean;
};

export function LoopKernelBoard({ hideWhenNoAccess = false, showHeader = false }: LoopKernelBoardProps) {
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);
  const [selected, setSelected] = useState<LoopItem | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase() ?? "";
    if (!email) {
      setNoAccess(true);
      setLoading(false);
      return;
    }
    const { data: member } = await supabase
      .from("members")
      .select("is_admin")
      .eq("email", email)
      .maybeSingle();
    if (!member?.is_admin) {
      setNoAccess(true);
      setLoading(false);
      return;
    }

    const todayStart = jstTodayStartIso();
    const [
      sourcesTodayRes,
      recentSourcesRes,
      msRevisionsRes,
      xrlCandidatesRes,
      l2NotifsRes,
      signalCandidatesRes,
      outboxRes,
      protocolCandidatesRes,
      textbookCandidatesRes,
      projectsRes,
    ] = await Promise.all([
      supabase
        .from("source_cache")
        .select("id", { count: "exact", head: true })
        .gte("collected_at", todayStart),
      supabase
        .from("source_cache")
        .select("id, title, source, project_id, item_date, collected_at, content_text, char_count")
        .order("collected_at", { ascending: false })
        .limit(3),
      supabase
        .from("ms_progress_revisions")
        .select("id, project_id, milestone_id, ym, current_pct, current_note, revised_pct, revised_note, requested_by, created_at", { count: "exact" })
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("project_xrl_evidence")
        .select("evidence_id", { count: "exact", head: true })
        .eq("status", "candidate"),
      supabase
        .from("l2_notifications")
        .select(
          "notification_id, l2_kind, target_id, scope_key, title, summary, importance, notified_at, created_at",
          { count: "exact" },
        )
        .is("read_at", null)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("project_strategy_signals")
        .select(
          "signal_id, project_id, ym, signal_type, title, summary, impact_level, decision_state, polarity, score_impact_summary, confidence, signal_date",
          { count: "exact" },
        )
        .eq("status", "candidate")
        .order("signal_date", { ascending: false })
        .limit(10),
      supabase
        .from("proactive_outbox")
        .select(
          "outbox_id, project_id, trigger_type, priority, draft_type, ball_owner, recommended_first_move, risk_if_late, due_at, status",
        )
        .in("status", ["queued", "sent_to_commander", "drafted", "blocked"])
        .order("due_at", { ascending: true })
        .limit(5),
      supabase
        .from("protocols")
        .select("protocol_id, project_id, title, content, importance, tags, kind", { count: "exact" })
        .eq("status", "candidate")
        .order("updated_at", { ascending: false })
        .limit(2),
      supabase
        .from("textbook_insight_candidates")
        .select("candidate_id, title, topic, insight_type, priority, target_bzm_slug, body_md", { count: "exact" })
        .eq("status", "candidate")
        .order("created_at", { ascending: false })
        .limit(2),
      supabase.from("projects").select("project_id, project_name"),
    ]);

    const projectName = new Map<string, string>(
      (projectsRes.data ?? []).map((p) => [str(p.project_id), str(p.project_name)]),
    );
    const pj = (id: unknown) => (id ? projectName.get(str(id)) ?? str(id) : "—");

    const observeItems: LoopItem[] = (recentSourcesRes.data ?? []).map((s) => ({
      id: `source-${str(s.id)}`,
      stage: "observe",
      chip: str(s.source),
      listText: `${pj(s.project_id)}: ${s.title ?? "(no title)"}`,
      modalTitle: str(s.title) || "(no title)",
      body: clampBody(s.content_text ? str(s.content_text) : null),
      fields: [
        { label: "PJ", value: pj(s.project_id) },
        { label: "ソース", value: str(s.source) },
        { label: "発生日時", value: formatJst(str(s.item_date) || null) },
        { label: "収集日時", value: formatJst(str(s.collected_at) || null) },
        { label: "文字数", value: s.char_count != null ? `${s.char_count}` : "—" },
      ],
    }));

    const assessItems: LoopItem[] = (msRevisionsRes.data ?? []).map((r) => ({
      id: `msrev-${str(r.id)}`,
      stage: "assess",
      chip: "MS",
      listText: `${pj(r.project_id)} ${str(r.ym)}: ${r.current_pct ?? "?"}% → ${r.revised_pct ?? "?"}%`,
      modalTitle: `MS進捗改訂案 ${pj(r.project_id)} ${str(r.ym)}`,
      body: clampBody(
        [
          r.current_note ? `現状メモ:\n${str(r.current_note)}` : null,
          r.revised_note ? `改訂理由:\n${str(r.revised_note)}` : null,
        ]
          .filter(Boolean)
          .join("\n\n") || null,
      ),
      fields: [
        { label: "PJ", value: pj(r.project_id) },
        { label: "対象月", value: str(r.ym) },
        { label: "マイルストーン", value: str(r.milestone_id) },
        { label: "進捗", value: `${r.current_pct ?? "?"}% → ${r.revised_pct ?? "?"}%` },
        { label: "提案者", value: str(r.requested_by) || "—" },
        { label: "作成", value: formatJst(str(r.created_at) || null) },
      ],
    }));

    const signalItems: LoopItem[] = (signalCandidatesRes.data ?? [])
      .slice()
      .sort(
        (a, b) =>
          (IMPACT_ORDER[str(a.impact_level)] ?? 9) - (IMPACT_ORDER[str(b.impact_level)] ?? 9),
      )
      .map((s) => ({
        id: `signal-${str(s.signal_id)}`,
        stage: "decide" as const,
        chip: str(s.impact_level),
        chipTone: IMPACT_TONE[str(s.impact_level)],
        listText: `${pj(s.project_id)}: ${str(s.title)}`,
        modalTitle: str(s.title),
        body: clampBody(
          [
            str(s.summary) || null,
            s.score_impact_summary ? `スコア影響:\n${str(s.score_impact_summary)}` : null,
          ]
            .filter(Boolean)
            .join("\n\n") || null,
        ),
        fields: [
          { label: "PJ", value: pj(s.project_id) },
          { label: "種別", value: str(s.signal_type) },
          { label: "インパクト", value: str(s.impact_level) },
          { label: "極性", value: str(s.polarity) || "—" },
          { label: "確度", value: s.confidence != null ? String(s.confidence) : "—" },
          { label: "シグナル日", value: str(s.signal_date) || "—" },
        ],
        decision: { type: "signal" as const, signalId: str(s.signal_id) },
      }));

    const l2Items: LoopItem[] = (l2NotifsRes.data ?? []).map((n) => ({
      id: `l2-${str(n.notification_id)}`,
      stage: "decide",
      chip: L2_KIND_LABEL[str(n.l2_kind)] ?? str(n.l2_kind),
      listText: str(n.title),
      modalTitle: str(n.title),
      body: clampBody(str(n.summary) || null),
      fields: [
        { label: "L2 種別", value: L2_KIND_LABEL[str(n.l2_kind)] ?? str(n.l2_kind) },
        { label: "重要度", value: str(n.importance) || "—" },
        { label: "対象", value: str(n.target_id) || "—" },
        { label: "スコープ", value: str(n.scope_key) || "—" },
        { label: "通知日時", value: formatJst(str(n.notified_at) || str(n.created_at) || null) },
      ],
      decision: {
        type: "l2" as const,
        notificationId: str(n.notification_id),
        l2Kind: str(n.l2_kind),
        targetId: str(n.target_id),
        scopeKey: str(n.scope_key),
      },
    }));

    const outboxRows = outboxRes.data ?? [];
    const actItems: LoopItem[] = outboxRows.map((o) => {
      const chip = dueChip(str(o.due_at) || null);
      return {
        id: `outbox-${str(o.outbox_id)}`,
        stage: "act",
        chip: chip.label,
        chipTone: chip.tone,
        listText: `${pj(o.project_id)}: ${str(o.recommended_first_move)}`,
        modalTitle: str(o.recommended_first_move),
        body: clampBody(o.risk_if_late ? `遅延リスク:\n${str(o.risk_if_late)}` : null),
        fields: [
          { label: "PJ", value: pj(o.project_id) },
          { label: "状態", value: str(o.status) },
          { label: "優先度", value: str(o.priority) },
          { label: "期限", value: formatJst(str(o.due_at) || null) },
          { label: "発生理由", value: str(o.trigger_type) },
          { label: "資料種別", value: str(o.draft_type) },
          { label: "ボール", value: str(o.ball_owner) || "—" },
        ],
      };
    });

    const learnItems: LoopItem[] = [
      ...(protocolCandidatesRes.data ?? []).map((p) => ({
        id: `protocol-${str(p.protocol_id)}`,
        stage: "learn" as const,
        chip: "Protocol",
        listText: str(p.title),
        modalTitle: str(p.title),
        body: clampBody(str(p.content) || null),
        fields: [
          { label: "PJ", value: pj(p.project_id) },
          { label: "重要度", value: p.importance != null ? String(p.importance) : "—" },
          { label: "タグ", value: str(p.tags) || "—" },
          { label: "種別", value: str(p.kind) || "—" },
        ],
      })),
      ...(textbookCandidatesRes.data ?? []).map((t) => ({
        id: `textbook-${str(t.candidate_id)}`,
        stage: "learn" as const,
        chip: "Textbook",
        listText: str(t.title),
        modalTitle: str(t.title),
        body: clampBody(str(t.body_md) || null),
        fields: [
          { label: "トピック", value: str(t.topic) || "—" },
          { label: "insight 種別", value: str(t.insight_type) || "—" },
          { label: "優先度", value: t.priority != null ? String(t.priority) : "—" },
          { label: "反映先", value: str(t.target_bzm_slug) || "—" },
        ],
      })),
    ];

    setData({
      observeCount: sourcesTodayRes.count ?? 0,
      observeItems,
      assessCount: (msRevisionsRes.count ?? 0) + (xrlCandidatesRes.count ?? 0),
      assessItems,
      assessXrlCount: xrlCandidatesRes.count ?? 0,
      decideCount: (l2NotifsRes.count ?? 0) + (signalCandidatesRes.count ?? 0),
      decideItems: [...signalItems.slice(0, 3), ...l2Items.slice(0, 2)],
      actCount: outboxRows.length,
      actRedCount: outboxRows.filter(
        (o) => o.priority === "red" || new Date(str(o.due_at)).getTime() < Date.now(),
      ).length,
      actItems,
      learnCount: (protocolCandidatesRes.count ?? 0) + (textbookCandidatesRes.count ?? 0),
      learnItems,
      protocolCount: protocolCandidatesRes.count ?? 0,
      textbookCount: textbookCandidatesRes.count ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (noAccess) {
    if (hideWhenNoAccess) return null;
    return (
      <p className="text-xs text-muted-foreground py-6 text-center">
        ループ盤面は admin 権限で表示されるよ
      </p>
    );
  }
  if (loading) {
    if (hideWhenNoAccess) return null;
    return <div className="h-40 rounded-lg border border-border/60 bg-muted/20 animate-pulse" />;
  }
  if (!data) return null;

  return (
    <section className="flex flex-col gap-2">
      {showHeader ? (
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">ループ</h2>
          <span className="text-[10px] text-muted-foreground">観測 → 評価 → 判断 → 実行 → 学習</span>
          <Link href="/loop" className="ml-auto text-[10px] text-primary hover:underline">
            全画面 →
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <StageCard
          icon="📡"
          title="観測"
          count={data.observeCount}
          countLabel="本日IN"
          href="/admin/settings"
          hrefLabel="Raw Data 台帳"
        >
          {data.observeItems.map((item) => (
            <ItemRow key={item.id} item={item} onOpen={() => setSelected(item)} />
          ))}
        </StageCard>

        <StageCard
          icon="📈"
          title="評価"
          count={data.assessCount}
          countLabel="改訂候補"
          href="/management-score"
          hrefLabel="Management Score"
        >
          {data.assessItems.map((item) => (
            <ItemRow key={item.id} item={item} onOpen={() => setSelected(item)} />
          ))}
          <StaticRow chip="XRL" text={`根拠 candidate ${data.assessXrlCount} 件`} />
        </StageCard>

        <StageCard
          icon="⚖️"
          title="判断"
          count={data.decideCount}
          countLabel="採否待ち"
          href="/notifications"
          hrefLabel="採否ゲート"
          highlight
        >
          {data.decideItems.map((item) => (
            <ItemRow key={item.id} item={item} onOpen={() => setSelected(item)} />
          ))}
        </StageCard>

        <StageCard
          icon="🚀"
          title="実行"
          count={data.actCount}
          countLabel={data.actRedCount > 0 ? `open / 🔴${data.actRedCount}` : "open"}
        >
          {data.actItems.length === 0 ? (
            <span className="text-muted-foreground">
              open outbox なし (検知 automation は Phase 2 で本稼働)
            </span>
          ) : (
            data.actItems
              .slice(0, 3)
              .map((item) => <ItemRow key={item.id} item={item} onOpen={() => setSelected(item)} />)
          )}
        </StageCard>

        <StageCard
          icon="📚"
          title="学習"
          count={data.learnCount}
          countLabel="資産化候補"
          href="/admin/protocols"
          hrefLabel="AMD Protocol"
        >
          {data.learnItems.map((item) => (
            <ItemRow key={item.id} item={item} onOpen={() => setSelected(item)} />
          ))}
          <StaticRow
            chip="合計"
            text={`Protocol ${data.protocolCount} 件 / Textbook ${data.textbookCount} 件`}
          />
        </StageCard>
      </div>

      {selected ? (
        <LoopItemModal
          item={selected}
          onClose={() => setSelected(null)}
          onActed={() => {
            setSelected(null);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

function StageCard(props: {
  icon: string;
  title: string;
  count: number;
  countLabel: string;
  href?: string;
  hrefLabel?: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-2 ${
        props.highlight ? "border-primary/60 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold">
          {props.icon} {props.title}
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="text-lg font-semibold text-foreground mr-1">{props.count}</span>
          {props.countLabel}
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-1.5 text-xs">{props.children}</div>
      {props.href ? (
        <Link href={props.href} className="text-xs text-primary hover:underline mt-1">
          {props.hrefLabel ?? "詳細"} →
        </Link>
      ) : null}
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone?: string }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-4 ${
        tone ?? "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

function ItemRow({ item, onOpen }: { item: LoopItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-start gap-2 w-full text-left rounded -mx-1 px-1 py-0.5 hover:bg-muted/40 transition-colors"
    >
      <Chip label={item.chip} tone={item.chipTone} />
      <span className="text-foreground/90 line-clamp-2">{item.listText}</span>
    </button>
  );
}

function StaticRow({ chip, text }: { chip: string; text: string }) {
  return (
    <div className="flex items-start gap-2 px-0 py-0.5">
      <Chip label={chip} />
      <span className="text-foreground/90 line-clamp-2">{text}</span>
    </div>
  );
}

const STAGE_LABEL: Record<Stage, string> = {
  observe: "📡 観測",
  assess: "📈 評価",
  decide: "⚖️ 判断",
  act: "🚀 実行",
  learn: "📚 学習",
};

function LoopItemModal({
  item,
  onClose,
  onActed,
}: {
  item: LoopItem;
  onClose: () => void;
  onActed: () => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approve" | "reject" | null>(null);

  const submitDecision = async (approve: boolean) => {
    if (!item.decision || busy || done) return;
    setBusy(approve ? "approve" : "reject");
    setError(null);
    try {
      if (item.decision.type === "signal") {
        const res = await fetch("/api/strategy-signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: approve ? "confirm" : "reject",
            signal_id: item.decision.signalId,
          }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || res.statusText);
        }
      } else {
        const res = await fetch("/api/notifications/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            l2_kind: item.decision.l2Kind,
            target_id: item.decision.targetId,
            scope_key: item.decision.scopeKey,
            notification_id: item.decision.notificationId,
            action: approve ? "yes" : "no",
            feedback_text: "",
          }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || res.statusText);
        }
        // 既読化 (= /notifications と同じ挙動)
        const supabase = createClient();
        await supabase
          .from("l2_notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("notification_id", item.decision.notificationId);
      }
      setDone(approve ? "approve" : "reject");
      setTimeout(onActed, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信エラー");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-3 py-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-muted-foreground">{STAGE_LABEL[item.stage]}</span>
              <Chip label={item.chip} tone={item.chipTone} />
            </div>
            <h3 className="mt-1 text-base font-semibold leading-snug">{item.modalTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto shrink-0 rounded border border-border p-1.5 text-muted-foreground hover:bg-muted/40"
            aria-label="詳細を閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 text-sm">
          {item.body ? (
            <section className="rounded-md border border-border/70 bg-muted/10 p-3">
              <p className="whitespace-pre-wrap leading-relaxed text-[13px]">{item.body}</p>
            </section>
          ) : null}

          <section className="grid gap-2 md:grid-cols-2">
            {item.fields.map((f) => (
              <div key={f.label} className="rounded-md border border-border/70 bg-background px-3 py-2">
                <div className="text-[11px] text-muted-foreground">{f.label}</div>
                <div className="mt-0.5 text-xs font-medium break-words">{f.value}</div>
              </div>
            ))}
          </section>

          {item.decision ? (
            <section className="border-t border-border pt-3">
              {done ? (
                <p
                  className={`rounded-md px-3 py-2 text-xs font-medium ${
                    done === "approve"
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-rose-500/10 text-rose-700"
                  }`}
                >
                  {done === "approve" ? "✅ 採用したよ" : "❌ 不採用にしたよ"}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => void submitDecision(true)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {busy === "approve" ? "送信中…" : "✅ 採用"}
                    </button>
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => void submitDecision(false)}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                    >
                      {busy === "reject" ? "送信中…" : "❌ 不採用"}
                    </button>
                    <span className="self-center text-[11px] text-muted-foreground">
                      採用 = 正本反映 / 不採用 = rejected 化
                    </span>
                  </div>
                  {error ? <p className="mt-2 text-xs text-rose-600">送信失敗: {error}</p> : null}
                </>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
