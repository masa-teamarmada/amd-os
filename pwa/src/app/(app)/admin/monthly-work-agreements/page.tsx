"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Search } from "lucide-react";
import type {
  AdminMonthlyWorkAgreementResponse,
  MonthlyAgreementAmountChangeReasonRequirement,
  MonthlyAgreementStatus,
  MonthlyWorkAgreementRevisionRequest,
} from "@/lib/monthly-work-agreement-types";

const REQUEST_TYPE_LABEL: Record<string, string> = {
  scope_or_goal: "担当内容",
  reward: "予定額",
  other: "その他",
};

function requestTypeLabel(requestType: string) {
  return REQUEST_TYPE_LABEL[requestType] ?? requestType;
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP");
}

function currentYmJst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatYm(ym: string) {
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function addMonths(ym: string, delta: number) {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function selectableYms(currentYm: string) {
  const result: string[] = [];
  const lastYm = addMonths(currentYm, 12);
  for (let candidate = "202001"; candidate <= lastYm; candidate = addMonths(candidate, 1)) {
    result.push(candidate);
  }
  return result.reverse();
}

function isPrelaunchYm(ym: string) {
  return ym < "202607";
}

function formatYen(value: number | null | undefined) {
  if (value == null) return "算定待ち";
  return `¥${Math.round(value).toLocaleString()}`;
}

function statusLabel(status: MonthlyAgreementStatus) {
  if (status === "agreed") return "合意済み";
  if (status === "needs_reagreement") return "条件更新あり";
  if (status === "not_required") return "対象外";
  return "未合意";
}

function statusClass(status: MonthlyAgreementStatus) {
  if (status === "agreed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "needs_reagreement") return "bg-amber-50 text-amber-800 border-amber-200";
  if (status === "not_required") return "bg-zinc-50 text-zinc-600 border-zinc-200";
  return "bg-sky-50 text-sky-800 border-sky-200";
}

export default function AdminMonthlyWorkAgreementsPage() {
  const [ym, setYm] = useState(currentYmJst());
  const [data, setData] = useState<AdminMonthlyWorkAgreementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const ymOptions = useMemo(() => selectableYms(currentYmJst()), []);

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

  const handleReasonSaved = useCallback((memberId: string, projectId: string, reason: string) => {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row) =>
          row.member.memberId !== memberId
            ? row
            : {
                ...row,
                amountChangeReasonRequirements: row.amountChangeReasonRequirements.map((requirement) =>
                  requirement.projectId === projectId ? { ...requirement, reason } : requirement,
                ),
              },
        ),
      };
    });
  }, []);

  const handleRevisionRequestUpdated = useCallback((updated: MonthlyWorkAgreementRevisionRequest) => {
    setData((current) => {
      if (!current) return current;
      const rows = current.rows.map((row) => {
        if (row.member.memberId !== updated.memberId) return row;
        const revisionRequests = row.revisionRequests.map((request) =>
          request.id === updated.id ? updated : request,
        );
        return {
          ...row,
          revisionRequests,
          revisionRequestCount: revisionRequests.filter((request) => request.status === "open").length,
        };
      });
      return {
        ...current,
        rows,
        totals: {
          ...current.totals,
          revisionRequests: rows.reduce((sum, row) => sum + row.revisionRequestCount, 0),
        },
      };
    });
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold">月初タスク・報酬合意</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatYm(ym)}の遂行内容/予定報酬について、メンバー別の合意状態と更新有無を確認する。
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">合意額</span>は、この稼働月について合意する「次に払う額」。
            当月のMS消化から発生する分に加えて、過去の未払いの返済分も含み、月次の支払枠を通した後の額。
            支払通知書とまったく同じ計算を使うので、両画面で必ず一致する。
            <span className="font-medium text-foreground">今月の支払通知書</span>は、この暦月に実際に発行される通知書の額
            (支払条件によって対象の稼働月がずれる)。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-2 text-sm">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">対象月</span>
            <select
              data-testid="admin-monthly-agreement-ym-select"
              value={ym}
              onChange={(event) => setYm(event.target.value)}
              className="min-w-0 bg-transparent pr-1 font-medium outline-none"
            >
              {ymOptions.map((optionYm) => (
                <option key={optionYm} value={optionYm}>
                  {formatYm(optionYm)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={load}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold"
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
          {isPrelaunchYm(ym) && (
            <div
              data-testid="monthly-agreement-migration-note"
              className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
            >
              <p className="font-semibold">この月の「対象外」について</p>
              <p className="mt-0.5 text-xs text-sky-800">
                2026年6月以前は月初合意の導入前・移行月。合意の保存は不要で、未合意を理由に支払いが止まることもない。
              </p>
            </div>
          )}

          {!data.tableReady && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              合意保存テーブルが未適用です。migration適用後に合意保存と既存合意の照合が有効になります。
            </div>
          )}

          <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            <SummaryCard
              label="対象メンバー"
              value={`${data.totals.members}`}
              note={`合意の単位は ${data.totals.projectAgreements} 件 (メンバー×PJ)`}
            />
            <SummaryCard
              label="合意済み"
              value={`${data.totals.projectAgreed}`}
              tone="good"
              note={`全PJ合意のメンバー ${data.totals.agreed}人`}
            />
            <SummaryCard
              label="未合意"
              value={`${data.totals.projectPending}`}
              tone={data.totals.projectPending > 0 ? "warn" : "plain"}
              note={`メンバー×PJ / 該当メンバー ${data.totals.pending}人`}
            />
            <SummaryCard
              label="条件更新あり"
              value={`${data.totals.projectNeedsReagreement}`}
              tone={data.totals.projectNeedsReagreement > 0 ? "warn" : "plain"}
              note={`メンバー×PJ / 該当メンバー ${data.totals.needsReagreement}人`}
            />
            <SummaryCard label="修正要望" value={`${data.totals.revisionRequests}`} tone={data.totals.revisionRequests > 0 ? "warn" : "plain"} />
            <SummaryCard label="合意額 (次に払う額)" value={formatYen(data.totals.expectedRewardYen)} tone={data.totals.expectedRewardYen > 0 ? "good" : "plain"} />
            <SummaryCard label="今月の支払通知書" value={formatYen(data.totals.payoutYen)} tone={data.totals.payoutYen > 0 ? "good" : "plain"} />
            <SummaryCard label="立替精算" value={formatYen(data.totals.reimbursementYen)} tone={data.totals.reimbursementYen > 0 ? "good" : "plain"} />
            <SummaryCard label="未払いストック残" value={formatYen(data.totals.stockYen)} tone={data.totals.stockYen > 0 ? "warn" : "plain"} />
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

          <section className="overflow-x-auto rounded-md border border-border bg-background">
            <div className="grid min-w-[980px] grid-cols-[128px_112px_64px_124px_124px_minmax(0,1fr)_132px] bg-muted/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
              <span>Member</span>
              <span>Status</span>
              <span className="text-right">PJ</span>
              <span className="text-right">合意額</span>
              <span className="text-right">未払い残</span>
              <span>PJ / 確認事項 / 修正要望</span>
              <span className="text-right">Detail</span>
            </div>
            <div className="divide-y divide-border">
              {filteredRows.length === 0 ? (
                <div className="px-3 py-8 text-sm text-muted-foreground">対象メンバーなし</div>
              ) : (
                filteredRows.map((row) => (
                  <div key={row.member.memberId} className="min-w-[980px]">
                    <div className="grid grid-cols-[128px_112px_64px_124px_124px_minmax(0,1fr)_132px] items-center gap-2 px-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.member.codeName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{row.member.memberId}</p>
                    </div>
                    <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(row.status)}`}>
                      {row.status === "agreed" ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                      {statusLabel(row.status)}
                    </span>
                    <span className="text-right tabular-nums">{row.projectCount}</span>
                    <div className="text-right tabular-nums">
                      <p className={`font-semibold ${row.expectedRewardYen > 0 ? "text-emerald-700" : "text-foreground"}`}>
                        {formatYen(row.expectedRewardYen)}
                      </p>
                      {row.reimbursementYen > 0 && (
                        <p className="mt-0.5 text-[10px] text-violet-700">＋立替 {formatYen(row.reimbursementYen)}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        当月発生 {formatYen(row.currentMonthAccrualYen)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        今月の通知書 {formatYen(row.payoutYen)}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className={`font-semibold ${row.stockYen > 0 ? "text-amber-800" : "text-muted-foreground"}`}>
                        {row.stockYen > 0 ? formatYen(row.stockYen) : "-"}
                      </p>
                      {row.stockYen > 0 && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          今月末
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      {row.projects.length === 0 ? (
                        <p className="truncate text-[12px] text-foreground">参加PJなし</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.projects.map((project) => (
                            <span
                              key={project.projectId}
                              title={`${project.projectName}: ${statusLabel(project.status)}${
                                project.fromLegacyMemberAgreement ? " (PJ単位化前の一括合意)" : ""
                              } / ${formatYen(project.expectedRewardYen ?? 0)} / 配分${project.allocationMemberCount}人`}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(project.status)}`}
                            >
                              {project.projectName}
                              <span className="font-normal">{statusLabel(project.status)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className={`mt-0.5 text-[11px] ${row.reviewRequiredCount > 0 ? "text-amber-700" : "text-muted-foreground"}`}>
                        確認事項 {row.reviewRequiredCount} / 修正要望 {row.revisionRequestCount} / hash {row.currentHash.slice(0, 10)}
                      </p>
                      {row.latestRevisionRequestAt && (
                        <p className="mt-0.5 text-[11px] text-amber-700">
                          最新要望 {new Date(row.latestRevisionRequestAt).toLocaleString("ja-JP")}
                        </p>
                      )}
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
                    {row.revisionRequests.length > 0 && (
                      <RevisionRequestsPanel
                        requests={row.revisionRequests}
                        onUpdated={handleRevisionRequestUpdated}
                      />
                    )}
                    {row.amountChangeReasonRequirements.length > 0 && (
                      <div className="border-t border-amber-200 bg-amber-50/60 px-3 py-3">
                        <div className="ml-[316px] max-w-3xl">
                          <p className="text-xs font-semibold text-amber-900">予定額が変わった理由</p>
                          <p className="mt-0.5 text-[11px] text-amber-800">
                            OSが要因を説明できたPJは、そのままメンバーが合意できる。ここに書くのは補足だけでいい。
                            OSが説明できないPJだけ、理由を入れないとメンバーが合意できない。
                          </p>
                          <div className="mt-2 grid gap-2">
                            {row.amountChangeReasonRequirements.map((requirement) => (
                              <AmountChangeReasonEditor
                                key={`${ym}:${row.member.memberId}:${requirement.projectId}`}
                                ym={ym}
                                memberId={row.member.memberId}
                                requirement={requirement}
                                onSaved={handleReasonSaved}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
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

function SummaryCard({
  label,
  value,
  tone = "plain",
  note,
}: {
  label: string;
  value: string;
  tone?: "plain" | "good" | "warn";
  note?: string;
}) {
  const valueClass = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * メンバーが出した修正要望を管理者が読んで閉じるパネル。
 *
 * open のあいだ、この稼働月の支払通知書は誰も発行できない (支払ゲートの blocker)。
 * 件数だけ出していた頃は本文が読めず閉じる手段も無かったので、要望が1件でも来ると
 * 支払業務が止まって復旧できなかった (2026-08-28 修正)。
 */
function RevisionRequestsPanel({
  requests,
  onUpdated,
}: {
  requests: MonthlyWorkAgreementRevisionRequest[];
  onUpdated: (updated: MonthlyWorkAgreementRevisionRequest) => void;
}) {
  const openRequests = requests.filter((request) => request.status === "open");
  const closedRequests = requests.filter((request) => request.status !== "open");
  return (
    <div
      data-testid="admin-monthly-agreement-revision-requests"
      className={`border-t px-3 py-3 ${openRequests.length > 0 ? "border-red-200 bg-red-50/60" : "border-border bg-muted/20"}`}
    >
      <div className="ml-[316px] max-w-3xl">
        <p className={`text-xs font-semibold ${openRequests.length > 0 ? "text-red-900" : "text-muted-foreground"}`}>
          メンバーからの修正要望
          {openRequests.length > 0 && `（未対応 ${openRequests.length}件 — この稼働月の支払通知書が発行できない状態）`}
        </p>
        <div className="mt-2 grid gap-2">
          {openRequests.map((request) => (
            <RevisionRequestCard key={request.id} request={request} onUpdated={onUpdated} />
          ))}
          {closedRequests.map((request) => (
            <RevisionRequestCard key={request.id} request={request} onUpdated={onUpdated} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RevisionRequestCard({
  request,
  onUpdated,
}: {
  request: MonthlyWorkAgreementRevisionRequest;
  onUpdated: (updated: MonthlyWorkAgreementRevisionRequest) => void;
}) {
  const [note, setNote] = useState(request.resolutionNote ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isOpen = request.status === "open";

  const patch = async (status: "resolved" | "rejected" | "open") => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/monthly-work-agreements/revision-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, status, note: note.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: MonthlyWorkAgreementRevisionRequest;
        error?: string;
      };
      if (!response.ok || payload.ok === false || !payload.data) {
        throw new Error(payload.error || "更新できませんでした");
      }
      onUpdated(payload.data);
      setMessage(status === "open" ? "未対応に戻した。" : "閉じた。支払ゲートのこの blocker は外れる。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-md border p-3 ${isOpen ? "border-red-200 bg-white" : "border-border bg-background"}`}>
      <div className="flex flex-wrap items-baseline gap-2 text-[11px]">
        <span
          className={`rounded-full border px-2 py-0.5 font-semibold ${
            isOpen
              ? "border-red-200 bg-red-50 text-red-800"
              : request.status === "rejected"
                ? "border-zinc-200 bg-zinc-50 text-zinc-600"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {isOpen ? "未対応" : request.status === "rejected" ? "対応しない" : "対応済み"}
        </span>
        <span className="font-semibold text-foreground">{requestTypeLabel(request.requestType)}</span>
        <span className="text-muted-foreground">{request.projectId ?? "全体"}</span>
        <span className="text-muted-foreground">{formatDateTime(request.createdAt)}</span>
        {!isOpen && request.resolvedAt && (
          <span className="text-muted-foreground">
            → {formatDateTime(request.resolvedAt)} {request.resolvedBy ?? ""}
          </span>
        )}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{request.body}</p>
      <label className="mt-2 block">
        <span className="text-[11px] font-semibold text-muted-foreground">対応メモ（任意・メンバーには出さない）</span>
        <textarea
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setMessage(null);
          }}
          rows={2}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#007aff]"
          placeholder="例: 予定額を見直して再合意を出した。"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {isOpen
            ? "閉じても金額は動かない。条件を直したいときは先にPJ側の金額・役割を直す。"
            : "未対応に戻すと、この稼働月の支払通知書はまた止まる。"}
        </p>
        <div className="flex shrink-0 gap-2">
          {isOpen ? (
            <>
              <button
                type="button"
                onClick={() => void patch("rejected")}
                disabled={saving}
                className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-semibold disabled:opacity-50"
              >
                対応しない
              </button>
              <button
                type="button"
                onClick={() => void patch("resolved")}
                disabled={saving}
                className="inline-flex min-h-9 items-center rounded-md bg-[#007aff] px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving ? "更新中…" : "対応済みにする"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void patch("open")}
              disabled={saving}
              className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-semibold disabled:opacity-50"
            >
              {saving ? "更新中…" : "未対応に戻す"}
            </button>
          )}
        </div>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${message.includes("外れる") || message.includes("戻した") ? "text-emerald-700" : "text-red-700"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

function AmountChangeReasonEditor({
  ym,
  memberId,
  requirement,
  onSaved,
}: {
  ym: string;
  memberId: string;
  requirement: MonthlyAgreementAmountChangeReasonRequirement;
  onSaved: (memberId: string, projectId: string, reason: string) => void;
}) {
  const [reason, setReason] = useState(requirement.reason ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const trimmedReason = reason.trim();
  const canSave = trimmedReason.length >= 8 && !saving;

  const save = async () => {
    if (!canSave) {
      setMessage("理由は8文字以上で入力してね。");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/monthly-work-agreements/amount-change-reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ym,
          memberId,
          projectId: requirement.projectId,
          reason: trimmedReason,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { reason?: string };
        error?: string;
      };
      if (!response.ok || payload.ok === false || !payload.data?.reason) {
        throw new Error(payload.error || "変更理由を保存できませんでした");
      }
      setReason(payload.data.reason);
      onSaved(memberId, requirement.projectId, payload.data.reason);
      setMessage("保存した。メンバー画面にすぐ反映されるよ。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="admin-monthly-agreement-change-reason"
      className="rounded-md border border-amber-200 bg-white p-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{requirement.projectName}</p>
        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
          今回の予定額 {requirement.expectedRewardYen == null ? "対象外" : formatYen(requirement.expectedRewardYen)}
        </p>
      </div>
      <div
        className={`mt-2 rounded-md border px-2.5 py-2 text-[11px] leading-relaxed ${
          requirement.autoExplained
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-red-200 bg-red-50 text-red-900"
        }`}
      >
        <p className="font-semibold">
          {requirement.autoExplained
            ? "OSが理由を説明済み — メンバーはこのまま合意できる"
            : "OSが理由を説明できない — 理由を入れるまでメンバーは合意できない"}
        </p>
        {requirement.autoExplanationDetails.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {requirement.autoExplanationDetails.map((detail, index) => (
              <li key={`${requirement.projectId}-auto-${index}`}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
      <label className="mt-2 block">
        <span className="text-xs font-semibold text-muted-foreground">
          メンバーに伝える補足{requirement.autoExplained ? "（任意）" : "（必須）"}
        </span>
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setMessage(null);
          }}
          rows={3}
          className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#007aff]"
          placeholder="例: 顧客との契約開始が翌月になったため、今月の予定額を見直しました。"
        />
      </label>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className={`text-xs ${trimmedReason.length >= 8 ? "text-muted-foreground" : "text-amber-800"}`}>
          {trimmedReason.length >= 8
            ? "保存すると、OSの説明の上にこの補足が出る。"
            : requirement.autoExplained
              ? "書かなくていい。書くなら8文字以上。"
              : "理由は8文字以上で入力してね。"}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="inline-flex min-h-9 shrink-0 items-center rounded-md bg-[#007aff] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "保存中…" : requirement.reason ? "理由を更新" : "理由を保存"}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${message.includes("反映") ? "text-emerald-700" : "text-red-700"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
