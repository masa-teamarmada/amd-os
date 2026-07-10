"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Files,
  Mail,
  MessageSquare,
  NotebookTabs,
  Settings2,
} from "lucide-react";

type SourceKey = "gmail" | "drive" | "calendar" | "slack" | "notion";
type SourceResolution = {
  reason: string;
  actionLabel: string;
  actionHref: string;
};
type SourceState = {
  count: number;
  lastCollectedAt: string | null;
  lastMeetingEvidenceAt: string | null;
  resolution: SourceResolution | null;
};
type ExtractionStatus = {
  checkedAt: string;
  sources: Record<SourceKey, SourceState>;
  setupIssues: Array<{
    projectId: string;
    projectName: string;
    missing: string[];
  }>;
};

const SOURCE_META: Array<{ key: SourceKey; label: string; icon: typeof Mail }> =
  [
    { key: "gmail", label: "Gmail", icon: Mail },
    { key: "drive", label: "Drive", icon: Files },
    { key: "calendar", label: "Calendar", icon: CalendarDays },
    { key: "slack", label: "Slack", icon: MessageSquare },
    { key: "notion", label: "Notion", icon: NotebookTabs },
  ];

function evidenceState(lastCollectedAt: string | null) {
  if (!lastCollectedAt)
    return { label: "保存証跡なし", className: "text-slate-600 bg-slate-100" };
  return { label: "保存証跡あり", className: "text-slate-700 bg-slate-100" };
}

function ResolutionLink({ resolution }: { resolution: SourceResolution }) {
  const className =
    "mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 hover:text-amber-950 hover:underline";
  if (resolution.actionHref.startsWith("/")) {
    return (
      <Link href={resolution.actionHref} className={className}>
        {resolution.actionLabel} <ArrowRight className="h-3 w-3" />
      </Link>
    );
  }
  return (
    <a
      href={resolution.actionHref}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {resolution.actionLabel} <ArrowRight className="h-3 w-3" />
    </a>
  );
}

function timeLabel(value: string | null) {
  if (!value) return "OSに保存された記録がない";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

/** 5生データの最終保存証跡と、抽出設定の不足をまとめる管理者用の運転盤。 */
export function ExtractionStatusCard() {
  const [data, setData] = useState<ExtractionStatus | null>(null);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/extraction-status")
      .then(async (response) => ({
        response,
        body: await response.json().catch(() => null),
      }))
      .then(({ response, body }) => {
        if (cancelled) return;
        if (response.status === 401 || response.status === 403)
          return setNoAccess(true);
        if (response.ok && body?.ok) setData(body as ExtractionStatus);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (noAccess) return null;
  if (!data)
    return (
      <div className="h-32 rounded-lg border border-border bg-muted/20 animate-pulse" />
    );

  const attention =
    data.setupIssues.length > 0 ||
    SOURCE_META.some(({ key }) => Boolean(data.sources[key].resolution));
  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full ${attention ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {attention ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">抽出状況</h2>
          <p className="text-[11px] text-muted-foreground">
            保存証跡と、MTG抽出で実際に使えた時刻。対応が必要な設定・認証だけを出す。
          </p>
        </div>
        <Link
          href="/admin/projects"
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
        >
          PJ台帳 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-border/70">
        {SOURCE_META.map(({ key, label, icon: Icon }) => {
          const source = data.sources[key];
          const state = evidenceState(source.lastCollectedAt);
          return (
            <div key={key} className="px-3 py-2.5 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {label}
              </div>
              <div
                className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${state.className}`}
              >
                {state.label}
              </div>
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock3 className="h-3 w-3" />
                保存: {timeLabel(source.lastCollectedAt)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                MTG抽出で使用: {timeLabel(source.lastMeetingEvidenceAt)}
              </div>
              {source.resolution && (
                <div className="mt-1.5 border-l-2 border-amber-300 pl-1.5 text-[10px] leading-snug text-amber-900">
                  <span className="font-medium">原因:</span>{" "}
                  {source.resolution.reason}
                  <ResolutionLink resolution={source.resolution} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {data.setupIssues.length > 0 && (
        <div className="border-t border-amber-200/80 bg-amber-50/40 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-950">
            <Settings2 className="h-3.5 w-3.5" />
            設定が必要 {data.setupIssues.length}件
          </div>
          <div className="mt-1.5 space-y-1">
            {data.setupIssues.map((issue) => (
              <Link
                key={issue.projectId}
                href="/admin/projects"
                className="flex items-start gap-2 rounded px-1 py-0.5 text-[11px] text-amber-950 hover:bg-amber-100/70"
              >
                <span className="font-semibold shrink-0">
                  {issue.projectName}
                </span>
                <span className="text-amber-800">
                  {issue.missing.join("・")}が未設定
                </span>
                <ArrowRight className="ml-auto mt-0.5 h-3 w-3 shrink-0 text-amber-700" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
