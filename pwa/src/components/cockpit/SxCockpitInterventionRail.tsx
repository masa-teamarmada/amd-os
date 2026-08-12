"use client";

import Link from "next/link";
import { ArrowUpRight, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  deriveSxCockpitInterventions,
  type SxCockpitInterventionSummary,
} from "@/lib/sx-cockpit-intervention";
import type { ProjectWorkspaceBundle } from "@/lib/project-workspace";

type WorkspaceResponse = {
  ok?: boolean;
  bundle?: ProjectWorkspaceBundle;
  error?: string;
};

function formatAsOf(value: string) {
  const match = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[1])}/${Number(match[2])}`;
}

const DUE_TONE = {
  overdue: "border-red-200 bg-red-50 text-red-700",
  due_soon: "border-amber-200 bg-amber-50 text-amber-800",
  upcoming: "border-slate-200 bg-slate-50 text-slate-600",
  unset: "border-slate-200 bg-white text-slate-500",
} as const;

export function SxCockpitInterventionRail({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<SxCockpitInterventionSummary | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/project-workspace/${encodeURIComponent(projectId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as WorkspaceResponse;
        if (!response.ok || !body.ok || !body.bundle) {
          throw new Error(body.error || "ワークスペースを読み込めなかった");
        }
        return body.bundle;
      })
      .then((bundle) => {
        setSummary(
          deriveSxCockpitInterventions(bundle.sxManagement, projectId),
        );
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "ワークスペースを読み込めなかった",
        );
      });

    return () => controller.abort();
  }, [projectId, reloadKey]);

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      aria-labelledby="sx-amd-intervention-heading"
      data-testid="sx-cockpit-intervention-rail"
    >
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-200 px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-[10px] font-bold tracking-[0.14em] text-indigo-700">
              SXワークスペース / AMD介入
            </p>
            {summary && (
              <span className="text-[10px] text-slate-400">
                {formatAsOf(summary.asOf)}時点
              </span>
            )}
          </div>
          <h2
            id="sx-amd-intervention-heading"
            className="mt-0.5 text-[15px] font-bold tracking-tight text-slate-950"
          >
            AMDがいま動かす判断
          </h2>
        </div>
        <span className="hidden text-[11px] text-slate-500 sm:block">
          共有正本から今週・期限超過を優先
        </span>
      </header>

      {!summary && !error && (
        <div className="flex min-h-16 items-center gap-2 px-4 text-xs text-slate-500">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          判断待ちを同期中
        </div>
      )}

      {error && (
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-slate-800">
              ワークスペースとの同期を確認できない
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setReloadKey((current) => current + 1);
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            再同期
          </button>
        </div>
      )}

      {summary && summary.items.length === 0 && (
        <div className="min-h-16 px-4 py-3">
          <p className="text-xs font-semibold text-emerald-800">
            今すぐAMDが介入する判断はない
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            SXワークスペースの判断待ちを確認済み
          </p>
        </div>
      )}

      {summary && summary.items.length > 0 && (
        <div className="divide-y divide-slate-100">
          <div className="hidden grid-cols-[34px_78px_minmax(0,1fr)_190px_112px_34px] items-center gap-2 bg-slate-50/80 px-3 py-1.5 text-[10px] font-semibold text-slate-500 md:grid">
            <span>順</span>
            <span>領域</span>
            <span>判断</span>
            <span>判断主体</span>
            <span>期限</span>
            <span className="sr-only">元項目</span>
          </div>
          {summary.items.map((item) => (
            <Link
              key={item.id}
              href={item.workspaceHref}
              className="group grid min-h-16 grid-cols-[30px_minmax(0,1fr)_44px] items-center gap-x-2 px-3 py-2.5 transition-colors hover:bg-indigo-50/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 md:grid-cols-[34px_78px_minmax(0,1fr)_190px_112px_34px]"
              aria-label={`${item.title}の元項目をワークスペースで開く`}
            >
              <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-400">
                {String(item.rank).padStart(2, "0")}
              </span>
              <span className="hidden w-fit rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 md:inline-flex">
                {item.trackLabel}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 md:hidden">
                  <span className="text-[10px] font-bold text-indigo-700">
                    {item.trackLabel}
                  </span>
                  {item.isThisWeek && (
                    <span className="text-[10px] font-semibold text-slate-500">
                      今週
                    </span>
                  )}
                </div>
                <p className="truncate text-[13px] font-semibold text-slate-950">
                  {item.title}
                </p>
                {item.context && (
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {item.context}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
                  <span className="text-[10px] text-slate-500">
                    {item.ownerLabel}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${DUE_TONE[item.dueState]}`}
                  >
                    {item.dueLabel}
                  </span>
                </div>
              </div>
              <span className="hidden truncate text-[11px] text-slate-600 md:block">
                {item.ownerLabel}
              </span>
              <span
                className={`hidden w-fit rounded border px-1.5 py-0.5 text-[10px] font-semibold md:inline-flex ${DUE_TONE[item.dueState]}`}
              >
                {item.dueLabel}
              </span>
              <span className="flex size-9 items-center justify-center rounded-lg text-slate-400 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-700">
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      )}

      {summary && summary.unlinkedDecisionCount > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
          元の論点と未接続の判断 {summary.unlinkedDecisionCount}件は表示していない
        </div>
      )}
    </section>
  );
}
