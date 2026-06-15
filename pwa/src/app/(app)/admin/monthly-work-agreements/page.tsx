"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Search } from "lucide-react";
import type { AdminMonthlyWorkAgreementResponse, MonthlyAgreementStatus } from "@/lib/monthly-work-agreement-types";

function currentYmJst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatYm(ym: string) {
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function formatYen(value: number | null | undefined) {
  if (value == null) return "未確定";
  return `¥${Math.round(value).toLocaleString()}`;
}

function statusLabel(status: MonthlyAgreementStatus) {
  if (status === "agreed") return "合意済み";
  if (status === "needs_reagreement") return "条件更新あり";
  return "未合意";
}

function statusClass(status: MonthlyAgreementStatus) {
  if (status === "agreed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "needs_reagreement") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-sky-50 text-sky-800 border-sky-200";
}

export default function AdminMonthlyWorkAgreementsPage() {
  const [ym, setYm] = useState(currentYmJst());
  const [data, setData] = useState<AdminMonthlyWorkAgreementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/monthly-work-agreements?ym=${encodeURIComponent(ym)}`, { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: AdminMonthlyWorkAgreementResponse; error?: string };
      if (!res.ok || payload.ok === false || !payload.data) throw new Error(payload.error || `取得に失敗 (${res.status})`);
      setData(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [ym]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.rows ?? [];
    return (data?.rows ?? []).filter((row) => {
      const haystack = [
        row.member.memberId,
        row.member.codeName,
        row.member.email,
        ...row.projectNames,
        row.status,
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [data?.rows, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold">月初タスク・報酬合意</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatYm(ym)}の遂行内容/報酬条件について、メンバー別の合意状態と条件更新を確認する。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={ym}
            onChange={(event) => setYm(event.target.value.replace(/[^\d]/g, "").slice(0, 6))}
            className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
            placeholder="YYYYMM"
          />
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold"
          >
            <RefreshCw className="size-4" />
            更新
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          読み込み中
        </div>
      )}

      {data && !loading && (
        <>
          {!data.tableReady && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              合意保存テーブルが未適用です。migration適用後に合意保存と既存合意の照合が有効になります。
            </div>
          )}

          <section className="grid gap-3 md:grid-cols-5">
            <SummaryCard label="対象メンバー" value={`${data.totals.members}`} />
            <SummaryCard label="合意済み" value={`${data.totals.agreed}`} tone="good" />
            <SummaryCard label="未合意" value={`${data.totals.pending}`} tone={data.totals.pending > 0 ? "warn" : "plain"} />
            <SummaryCard label="条件更新あり" value={`${data.totals.needsReagreement}`} tone={data.totals.needsReagreement > 0 ? "warn" : "plain"} />
            <SummaryCard label="要確認あり" value={`${data.totals.reviewRequired}`} tone={data.totals.reviewRequired > 0 ? "warn" : "plain"} />
          </section>

          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="member / PJ / status で検索"
            />
          </div>

          <section className="overflow-hidden rounded-md border border-border bg-background">
            <div className="grid grid-cols-[128px_112px_92px_120px_minmax(0,1fr)_132px] bg-muted/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
              <span>Member</span>
              <span>Status</span>
              <span className="text-right">PJ</span>
              <span className="text-right">想定報酬</span>
              <span>PJ / 要確認</span>
              <span className="text-right">Detail</span>
            </div>
            <div className="divide-y divide-border">
              {filteredRows.length === 0 ? (
                <div className="px-3 py-8 text-sm text-muted-foreground">対象メンバーなし</div>
              ) : (
                filteredRows.map((row) => (
                  <div
                    key={row.member.memberId}
                    className="grid grid-cols-[128px_112px_92px_120px_minmax(0,1fr)_132px] items-center gap-2 px-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.member.codeName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{row.member.memberId}</p>
                    </div>
                    <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(row.status)}`}>
                      {row.status === "agreed" ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                      {statusLabel(row.status)}
                    </span>
                    <span className="text-right tabular-nums">{row.projectCount}</span>
                    <span className="text-right tabular-nums font-semibold">{formatYen(row.expectedRewardYen)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-foreground">{row.projectNames.join(" / ") || "参加PJなし"}</p>
                      <p className={`mt-0.5 text-[11px] ${row.reviewRequiredCount > 0 ? "text-amber-700" : "text-muted-foreground"}`}>
                        要確認 {row.reviewRequiredCount} / hash {row.currentHash.slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/monthly-agreement?ym=${encodeURIComponent(ym)}&memberId=${encodeURIComponent(row.member.memberId)}`}
                        className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                      >
                        表示
                      </Link>
                      <Link
                        href={`/mypage?memberId=${encodeURIComponent(row.member.memberId)}`}
                        className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                      >
                        mypage
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone = "plain" }: { label: string; value: string; tone?: "plain" | "good" | "warn" }) {
  const valueClass = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
