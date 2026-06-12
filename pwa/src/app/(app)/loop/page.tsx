import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "ループ - AMD OS" } };

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * /loop — 経営レンズ Phase 1 MVP (ループカーネルダッシュボード)
 *
 * 仕様正本: pwa/spec/2-4-loop-kernel-role-lenses-plan.md
 * 観測→評価→判断→実行→学習の 5 段ループを 1 画面で輪切りにする admin 専用ビュー。
 * 既存画面 (/notifications, /admin/protocols 等) を置き換えず、各段の入口として束ねる。
 */

const IMPACT_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

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

function ItemRow(props: { chip?: string; chipTone?: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      {props.chip ? (
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-4 ${
            props.chipTone ?? "bg-muted text-muted-foreground"
          }`}
        >
          {props.chip}
        </span>
      ) : null}
      <span className="text-foreground/90 line-clamp-2">{props.text}</span>
    </div>
  );
}

export default async function LoopPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? "";
  if (!email) notFound();
  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", email)
    .maybeSingle();
  if (!member?.is_admin) notFound();

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
      .select("title, source, project_id, collected_at")
      .order("collected_at", { ascending: false })
      .limit(3),
    supabase
      .from("ms_progress_revisions")
      .select("project_id, ym, current_pct, revised_pct, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("project_xrl_evidence")
      .select("evidence_id", { count: "exact", head: true })
      .eq("status", "candidate"),
    supabase
      .from("l2_notifications")
      .select("notification_id, l2_kind, title, importance, created_at")
      .is("read_at", null)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("project_strategy_signals")
      .select("signal_id, project_id, title, impact_level, signal_date")
      .eq("status", "candidate")
      .order("signal_date", { ascending: false })
      .limit(10),
    supabase
      .from("proactive_outbox")
      .select("outbox_id, project_id, trigger_type, priority, draft_type, recommended_first_move, due_at, status")
      .in("status", ["queued", "sent_to_commander", "drafted", "blocked"])
      .order("due_at", { ascending: true })
      .limit(5),
    supabase
      .from("protocols")
      .select("id", { count: "exact", head: true })
      .eq("status", "candidate"),
    supabase
      .from("textbook_insight_candidates")
      .select("candidate_id", { count: "exact", head: true })
      .eq("status", "candidate"),
    supabase.from("projects").select("project_id, project_name"),
  ]);

  const projectName = new Map<string, string>(
    (projectsRes.data ?? []).map((p) => [p.project_id as string, p.project_name as string]),
  );
  const pj = (id: string | null) => (id ? projectName.get(id) ?? id : "—");

  const signals = (signalCandidatesRes.data ?? [])
    .slice()
    .sort(
      (a, b) =>
        (IMPACT_ORDER[a.impact_level as string] ?? 9) - (IMPACT_ORDER[b.impact_level as string] ?? 9),
    )
    .slice(0, 3);

  const outbox = outboxRes.data ?? [];
  const outboxRed = outbox.filter(
    (o) => o.priority === "red" || new Date(o.due_at as string).getTime() < Date.now(),
  ).length;

  const decideCount = (l2NotifsRes.data?.length ?? 0) + (signalCandidatesRes.data?.length ?? 0);
  const assessCount = (msRevisionsRes.data?.length ?? 0) + (xrlCandidatesRes.count ?? 0);
  const learnCount = (protocolCandidatesRes.count ?? 0) + (textbookCandidatesRes.count ?? 0);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">ループ</h1>
        <span className="text-sm text-muted-foreground">観測 → 評価 → 判断 → 実行 → 学習</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        経営レンズ Phase 1 MVP。今日ループのどこが詰まっているかを見る (正本:{" "}
        <Link href="/spec/2-4-loop-kernel-role-lenses-plan" className="text-primary hover:underline">
          spec 2-4
        </Link>
        )。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <StageCard
          icon="📡"
          title="観測"
          count={sourcesTodayRes.count ?? 0}
          countLabel="本日IN"
          href="/admin/settings"
          hrefLabel="Raw Data 台帳"
        >
          {(recentSourcesRes.data ?? []).map((s, i) => (
            <ItemRow key={i} chip={s.source as string} text={`${pj(s.project_id as string)}: ${s.title ?? "(no title)"}`} />
          ))}
        </StageCard>

        <StageCard
          icon="📈"
          title="評価"
          count={assessCount}
          countLabel="改訂候補"
          href="/management-score"
          hrefLabel="Management Score"
        >
          {(msRevisionsRes.data ?? []).map((r, i) => (
            <ItemRow
              key={i}
              chip="MS"
              text={`${pj(r.project_id as string)} ${r.ym}: ${r.current_pct ?? "?"}% → ${r.revised_pct ?? "?"}%`}
            />
          ))}
          <ItemRow chip="XRL" text={`根拠 candidate ${xrlCandidatesRes.count ?? 0} 件`} />
        </StageCard>

        <StageCard
          icon="⚖️"
          title="判断"
          count={decideCount}
          countLabel="採否待ち"
          href="/notifications"
          hrefLabel="採否ゲート"
          highlight
        >
          {signals.map((s) => (
            <ItemRow
              key={s.signal_id as string}
              chip={s.impact_level as string}
              chipTone={
                s.impact_level === "critical"
                  ? "bg-red-500/15 text-red-500"
                  : s.impact_level === "high"
                    ? "bg-amber-500/15 text-amber-600"
                    : undefined
              }
              text={`${pj(s.project_id as string)}: ${s.title}`}
            />
          ))}
          {(l2NotifsRes.data ?? []).slice(0, 2).map((n) => (
            <ItemRow key={n.notification_id as string} chip={n.l2_kind as string} text={n.title as string} />
          ))}
        </StageCard>

        <StageCard
          icon="🚀"
          title="実行"
          count={outbox.length}
          countLabel={outboxRed > 0 ? `open / 🔴${outboxRed}` : "open"}
        >
          {outbox.length === 0 ? (
            <span className="text-muted-foreground">
              open outbox なし (検知 automation は Phase 2 で本稼働)
            </span>
          ) : (
            outbox.slice(0, 3).map((o) => {
              const chip = dueChip(o.due_at as string);
              return (
                <ItemRow
                  key={o.outbox_id as string}
                  chip={chip.label}
                  chipTone={chip.tone}
                  text={`${pj(o.project_id as string)}: ${o.recommended_first_move}`}
                />
              );
            })
          )}
        </StageCard>

        <StageCard
          icon="📚"
          title="学習"
          count={learnCount}
          countLabel="資産化候補"
          href="/admin/protocols"
          hrefLabel="AMD Protocol"
        >
          <ItemRow chip="Protocol" text={`candidate ${protocolCandidatesRes.count ?? 0} 件`} />
          <ItemRow chip="Textbook" text={`insight candidate ${textbookCandidatesRes.count ?? 0} 件`} />
        </StageCard>
      </div>
    </div>
  );
}
