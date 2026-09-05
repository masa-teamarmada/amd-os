"use client";

/**
 * 研究機関詳細 (/institutions/[institutionId]) の「支援プログラム」節。
 * 支援プログラム比較と同じ参照系キャッシュから、この機関の16項目 + 制度整備の詳細 (21項目) を1機関分だけ描く。
 * 全機関との比較は /institutions の「支援プログラム比較」「分析」タブへ送る。
 */
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { POLICY_STATUS_LABEL, POLICY_STATUS_TONE } from "@/lib/institution-policy";
import {
  loadInstitutionSupportPrograms,
  peekInstitutionSupportPrograms,
} from "@/lib/institution-support-programs-client";
import type { SupportProgramBundle } from "@/types/institution-support-programs";

const CLAMP_2: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

export function InstitutionSupportProfile({ institutionId }: { institutionId: string }) {
  const [bundle, setBundle] = useState<SupportProgramBundle | undefined>(() => peekInstitutionSupportPrograms());
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const reload = useCallback(
    () =>
      loadInstitutionSupportPrograms()
        .then((value) => {
          setBundle(value);
          setError("");
        })
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "読み込み失敗")),
    [],
  );
  useEffect(() => {
    if (!bundle) void reload();
  }, [bundle, reload]);

  const cells = useMemo(
    () => new Map((bundle?.cells ?? []).filter((c) => c.institutionId === institutionId).map((c) => [c.policyItemId, c])),
    [bundle, institutionId],
  );
  const extra = useMemo(
    () => new Map((bundle?.extraCells ?? []).filter((c) => c.institutionId === institutionId).map((c) => [c.policyItemId, c])),
    [bundle, institutionId],
  );
  const columns = useMemo(() => bundle?.columns ?? [], [bundle]);
  const groups = useMemo(() => {
    const out: Array<{ group: string; columns: typeof columns }> = [];
    for (const column of columns) {
      const last = out.at(-1);
      if (last && last.group === column.group) last.columns.push(column);
      else out.push({ group: column.group, columns: [column] });
    }
    return out;
  }, [columns]);
  const extraItems = useMemo(
    () => (bundle?.items ?? []).filter((item) => item.compareSort == null && item.key !== "support_summary"),
    [bundle],
  );
  const summary = useMemo(() => {
    const item = (bundle?.items ?? []).find((entry) => entry.key === "support_summary");
    return item ? (extra.get(item.policyItemId)?.value ?? null) : null;
  }, [bundle, extra]);

  const counts = useMemo(() => {
    let established = 0;
    let confirmed = 0;
    for (const column of columns) {
      const status = cells.get(column.policyItemId)?.status ?? "unknown";
      if (status !== "unknown") confirmed += 1;
      if (status === "established") established += 1;
    }
    return { established, confirmed, total: columns.length };
  }, [columns, cells]);

  return (
    <section className="space-y-3 rounded-lg border border-border p-4" aria-labelledby="institution-support-profile-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="institution-support-profile-title" className="text-sm font-semibold">
            支援プログラム
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            認定の条件と、認定後に提供する支援。
            {bundle && (
              <>
                {" "}
                整備済み <span className="font-semibold text-foreground">{counts.established}</span> / 確認済み {counts.confirmed}（全{counts.total}項目）
              </>
            )}
          </p>
        </div>
        <Link href="/institutions" className="text-xs font-semibold text-indigo-700 hover:underline">
          全機関と比べる →
        </Link>
      </div>

      {error && <p className="border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{error}</p>}

      {summary && (
        <p className="border-l-2 border-indigo-300 pl-2 text-[12px] leading-relaxed text-foreground/90">{summary}</p>
      )}

      {!bundle ? (
        <div className="divide-y divide-border/60">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 py-2">
              <span className="h-3 w-28 animate-pulse rounded bg-muted" />
              <span className="h-3 flex-1 animate-pulse rounded bg-muted/70" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((group) => (
            <div key={group.group} className="overflow-hidden rounded border border-border">
              <h3 className="border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] font-bold text-indigo-800">{group.group}</h3>
              <dl className="divide-y divide-border/60">
                {group.columns.map((column) => {
                  const cell = cells.get(column.policyItemId);
                  const status = cell?.status ?? "unknown";
                  return (
                    <div key={column.policyItemId} className="grid grid-cols-[112px_1fr] gap-2 px-3 py-1.5">
                      <dt className="text-[11px] font-medium text-foreground" title={column.description ?? column.fullLabel}>
                        {column.label}
                      </dt>
                      <dd className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-block border px-1 py-px text-[10px] font-semibold ${POLICY_STATUS_TONE[status]}`}>
                            {POLICY_STATUS_LABEL[status]}
                          </span>
                          {cell?.value && <span className="text-[11px] text-foreground">{cell.value}</span>}
                        </div>
                        {cell?.note && (
                          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground" style={CLAMP_2} title={cell.note}>
                            {cell.note}
                          </p>
                        )}
                        {cell?.sourceUrl && (
                          <a
                            href={cell.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[10px] text-indigo-700 hover:underline"
                          >
                            <span className="truncate">{cell.sourceUrl.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>
      )}

      {bundle && extraItems.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="text-xs font-semibold text-indigo-700 hover:underline"
            aria-expanded={showDetails}
          >
            {showDetails ? "制度整備の詳細を閉じる" : `制度整備の詳細（${extraItems.length}項目）を見る`}
          </button>
          {showDetails && (
            <dl className="mt-2 grid gap-x-4 gap-y-1 rounded border border-border p-3 md:grid-cols-2">
              {extraItems.map((item) => {
                const cell = extra.get(item.policyItemId);
                const status = cell?.status ?? "unknown";
                return (
                  <div key={item.policyItemId} className="grid grid-cols-[140px_1fr] gap-2 py-1 text-[11px]">
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-block border px-1 py-px text-[10px] font-semibold ${POLICY_STATUS_TONE[status]}`}>
                        {POLICY_STATUS_LABEL[status]}
                      </span>
                      {cell?.value && <span className="text-foreground">{cell.value}</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      )}
    </section>
  );
}
