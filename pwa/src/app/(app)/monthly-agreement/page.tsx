"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CircleDollarSign, FileCheck2, Loader2, RefreshCw, Send } from "lucide-react";
import type { MonthlyWorkAgreementBundle, MonthlyWorkAgreementProject } from "@/lib/monthly-work-agreement-types";

function currentYmJst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatYm(ym: string) {
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function formatYen(value: number | null | undefined) {
  if (value == null) return "算定待ち";
  return `¥${Math.round(value).toLocaleString()}`;
}

function statusLabel(status: MonthlyWorkAgreementBundle["status"]) {
  if (status === "agreed") return "合意済み";
  if (status === "needs_reagreement") return "条件更新あり";
  if (status === "not_required") return "対象外";
  return "未合意";
}

function statusClass(status: MonthlyWorkAgreementBundle["status"]) {
  if (status === "agreed") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "needs_reagreement") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "not_required") return "border-[#d1d1d6] bg-white text-[#3c3c43]";
  return "border-sky-200 bg-sky-50 text-sky-950";
}

function MonthlyAgreementLoading() {
  return (
    <div className="min-h-screen grid place-items-center bg-[#f5f5f7]">
      <div className="flex items-center gap-2 text-sm text-[#6e6e73]">
        <Loader2 className="size-4 animate-spin" />
        読み込み中
      </div>
    </div>
  );
}

export default function MonthlyAgreementPage() {
  return (
    <Suspense fallback={<MonthlyAgreementLoading />}>
      <MonthlyAgreementContent />
    </Suspense>
  );
}

function MonthlyAgreementContent() {
  const searchParams = useSearchParams();
  const ym = searchParams.get("ym") || currentYmJst();
  const memberId = searchParams.get("memberId") || "";
  const [bundle, setBundle] = useState<MonthlyWorkAgreementBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestBody, setRequestBody] = useState("");
  const [requestProjectId, setRequestProjectId] = useState("");
  const [requestType, setRequestType] = useState("scope_or_goal");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ ym });
    if (memberId) params.set("memberId", memberId);
    try {
      const res = await fetch(`/api/monthly-work-agreement?${params.toString()}`, { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; bundle?: MonthlyWorkAgreementBundle; error?: string };
      if (!res.ok || payload.ok === false || !payload.bundle) {
        throw new Error(payload.error || `取得に失敗 (${res.status})`);
      }
      setBundle(payload.bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [memberId, ym]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAgree = async () => {
    if (!bundle || saving || !bundle.canAgree) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/monthly-work-agreement/agree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ym: bundle.ym, memberId: bundle.member.memberId }),
      });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; bundle?: MonthlyWorkAgreementBundle; error?: string };
      if (!res.ok || payload.ok === false || !payload.bundle) {
        throw new Error(payload.error || `保存に失敗 (${res.status})`);
      }
      setBundle(payload.bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRevisionRequest = async () => {
    if (!bundle || requestSaving || !bundle.canAgree) return;
    setRequestSaving(true);
    setError(null);
    setRequestMessage(null);
    try {
      const res = await fetch("/api/monthly-work-agreement/request-revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ym: bundle.ym,
          memberId: bundle.member.memberId,
          projectId: requestProjectId || null,
          requestType,
          body: requestBody,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; bundle?: MonthlyWorkAgreementBundle; error?: string };
      if (!res.ok || payload.ok === false || !payload.bundle) {
        throw new Error(payload.error || `保存に失敗 (${res.status})`);
      }
      setBundle(payload.bundle);
      setRequestBody("");
      setRequestProjectId("");
      setRequestType("scope_or_goal");
      setRequestMessage("修正要望を送信しました。admin/PM側の確認待ちです。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRequestSaving(false);
    }
  };

  if (loading) return <MonthlyAgreementLoading />;

  if (error || !bundle) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700">
          {error || "データ取得に失敗しました"}
          <button onClick={load} className="ml-3 rounded-md border border-red-200 px-3 py-1 text-xs font-semibold">
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const totalStockYen = bundle.snapshot.totals.stockYen ?? 0;

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-12">
      <div className="border-b border-[#e5e5e7] bg-white px-4 py-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#86868b]">Monthly Agreement</p>
            <h1 className="mt-1 text-[22px] font-semibold text-[#1d1d1f]">{formatYm(bundle.ym)}の遂行内容と予定報酬</h1>
            <p className="mt-1 text-[13px] text-[#6e6e73]">
              {bundle.member.codeName} / snapshot {bundle.currentHash.slice(0, 10)}
            </p>
          </div>
          <Link href="/mypage" className="text-sm font-semibold text-[#007aff]">マイページへ</Link>
        </div>
      </div>

      <main className="mx-auto mt-6 flex max-w-5xl flex-col gap-5 px-4">
        <section className={`rounded-lg border p-4 ${statusClass(bundle.status)}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {bundle.status === "agreed" ? <CheckCircle2 className="mt-0.5 size-5" /> : <FileCheck2 className="mt-0.5 size-5" />}
              <div>
                <p className="text-sm font-semibold">{statusLabel(bundle.status)}</p>
                <p className="mt-1 text-xs leading-relaxed">
                  {bundle.status === "agreed"
                    ? `合意時刻: ${bundle.latestAgreement?.agreedAt ? new Date(bundle.latestAgreement.agreedAt).toLocaleString("ja-JP") : "記録済み"}`
                    : bundle.status === "needs_reagreement"
                      ? "前回合意後に今月の遂行内容または予定報酬が変わっています。内容を確認して再合意してください。"
                      : bundle.status === "not_required"
                        ? bundle.exclusionReason || "この月の月初合意は不要です。"
                        : "業務開始前に、今月の遂行対象・到達目標・予定報酬を確認して合意してください。"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAgree}
              disabled={saving || bundle.status === "agreed" || !bundle.tableReady || !bundle.canAgree}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              title={!bundle.canAgree ? bundle.exclusionReason || "本人だけが合意を保存できます" : "今月の遂行内容と予定報酬を確認して合意"}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
              {bundle.status === "agreed" ? "合意済み" : bundle.status === "not_required" ? "合意不要" : "確認して合意"}
            </button>
          </div>
          {!bundle.tableReady && (
            <p className="mt-3 rounded-md border border-red-200 bg-white/70 px-3 py-2 text-xs text-red-700">
              合意保存テーブルが未適用です。migration適用後に保存できます。
            </p>
          )}
        </section>

        <section className={`grid gap-3 ${totalStockYen > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <MetricCard label="参加PJ" value={`${bundle.snapshot.totals.projectCount}`} />
          <MetricCard label="予定報酬合計" value={formatYen(bundle.snapshot.totals.expectedRewardYen)} />
          {totalStockYen > 0 && <MetricCard label="未払いストック" value={formatYen(totalStockYen)} emphasis />}
        </section>

        <section className="rounded-lg border border-[#e5e5e7] bg-white p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">修正要望</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73]">
                担当MS、到達目標、予定報酬が違う場合はここから送ってください。
              </p>
            </div>
            {bundle.revisionRequests.filter((request) => request.status === "open").length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                未解決 {bundle.revisionRequests.filter((request) => request.status === "open").length}
              </span>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[160px_180px_minmax(0,1fr)]">
            <select
              value={requestType}
              onChange={(event) => setRequestType(event.target.value)}
              disabled={!bundle.canAgree}
              className="rounded-md border border-[#d1d1d6] bg-white px-2 py-2 text-sm"
            >
              <option value="scope_or_goal">遂行対象/到達目標</option>
              <option value="reward">予定報酬</option>
              <option value="other">その他</option>
            </select>
            <select
              value={requestProjectId}
              onChange={(event) => setRequestProjectId(event.target.value)}
              disabled={!bundle.canAgree}
              className="rounded-md border border-[#d1d1d6] bg-white px-2 py-2 text-sm"
            >
              <option value="">全体</option>
              {bundle.snapshot.projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>{project.projectName}</option>
              ))}
            </select>
            <textarea
              value={requestBody}
              onChange={(event) => setRequestBody(event.target.value)}
              disabled={!bundle.canAgree}
              rows={3}
              className="min-h-[84px] rounded-md border border-[#d1d1d6] bg-white px-3 py-2 text-sm outline-none focus:border-[#007aff]"
              placeholder="例: CXの今月到達目標はこのMSではなく、登記準備を優先したい / 予定報酬の配分が違う"
            />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-[#86868b]">
              送信時点のsnapshot hashと一緒に保存されます。合意そのものは必要に応じて別途押してください。
            </p>
            <button
              type="button"
              onClick={handleRevisionRequest}
              disabled={requestSaving || !bundle.canAgree || requestBody.trim().length < 4}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#1d1d1f] bg-white px-3 py-2 text-xs font-semibold text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {requestSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              修正要望を送信
            </button>
          </div>
          {requestMessage && <p className="mt-2 text-[12px] text-emerald-700">{requestMessage}</p>}
          {bundle.revisionRequests.length > 0 && (
            <div className="mt-3 divide-y divide-[#e5e5e7] rounded-md border border-[#e5e5e7]">
              {bundle.revisionRequests.slice(0, 3).map((request) => (
                <div key={request.id} className="px-3 py-2 text-[12px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#1d1d1f]">{request.status === "open" ? "未解決" : request.status}</span>
                    <span className="text-[#86868b]">{request.projectId || "全体"} / {new Date(request.createdAt).toLocaleString("ja-JP")}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[#3c3c43]">{request.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          {bundle.snapshot.projects.length === 0 ? (
            <div className="rounded-lg border border-[#e5e5e7] bg-white p-5 text-sm text-[#6e6e73]">
              {bundle.exclusionReason || `${formatYm(bundle.ym)}に参加中のPJはありません。`}
            </div>
          ) : (
            bundle.snapshot.projects.map((project) => <ProjectAgreementCard key={project.projectId} project={project} />)
          )}
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-md border border-[#d1d1d6] bg-white px-3 py-2 text-xs font-semibold text-[#3c3c43]"
          >
            <RefreshCw className="size-3.5" />
            再読み込み
          </button>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-lg border border-[#e5e5e7] bg-white p-4">
      <p className="text-[12px] font-semibold text-[#86868b]">{label}</p>
      <p className={`mt-2 text-[24px] font-semibold tabular-nums ${emphasis ? "text-amber-700" : "text-[#1d1d1f]"}`}>{value}</p>
    </div>
  );
}

function ProjectAgreementCard({ project }: { project: MonthlyWorkAgreementProject }) {
  const stockYen = project.stockYen ?? 0;
  const hasStock = stockYen > 0;
  const hasPayout = project.payoutYen != null;
  return (
    <article className="rounded-lg border border-[#e5e5e7] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">{project.projectName}</h2>
            {project.isPm && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">PM</span>}
            {project.isPl && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">PL</span>}
          </div>
          <p className="mt-1 text-xs text-[#86868b]">{project.projectId} / billing {project.billingStatus || "未作成"}</p>
        </div>
        <div className={`rounded-md border px-3 py-2 text-right ${hasStock ? "border-amber-200 bg-amber-50" : "border-transparent bg-[#f5f5f7]"}`}>
          <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-[#86868b]">
            <CircleDollarSign className="size-3.5" />
            {hasPayout ? "今月支払" : "予定報酬"}
          </div>
          <p className={`mt-1 text-[20px] font-semibold tabular-nums ${hasPayout && (project.payoutYen ?? 0) > 0 ? "text-emerald-700" : "text-[#1d1d1f]"}`}>
            {formatYen(hasPayout ? project.payoutYen : project.expectedRewardYen)}
          </p>
          {hasStock && (
            <div className="mt-2 rounded-md border border-amber-200 bg-white px-2 py-1 text-left">
              <p className="text-[10px] font-semibold text-amber-800">未払いストック（今月は支払われない）</p>
              <p className="mt-0.5 text-right text-[16px] font-semibold tabular-nums text-amber-800">{formatYen(stockYen)}</p>
            </div>
          )}
          {hasPayout && project.expectedRewardYen != null && (
            <p className="mt-1 text-[10px] tabular-nums text-[#86868b]">合意用予定報酬 {formatYen(project.expectedRewardYen)}</p>
          )}
          {hasStock && project.grossDueYen != null && (
            <p className="mt-1 text-[10px] tabular-nums text-[#86868b]">支払対象額 {formatYen(project.grossDueYen)}</p>
          )}
        </div>
      </div>

      {project.milestones.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-md border border-[#e5e5e7]">
          <div className="grid grid-cols-[minmax(0,1fr)_74px_92px_102px] bg-[#f5f5f7] px-3 py-2 text-[11px] font-semibold text-[#6e6e73]">
            <span>遂行対象</span>
            <span className="text-right">share</span>
            <span className="text-right">到達目標</span>
            <span className="text-right">予定報酬</span>
          </div>
          <div className="divide-y divide-[#e5e5e7]">
            {project.milestones.map((ms) => (
              <div key={ms.milestoneId} className="grid grid-cols-[minmax(0,1fr)_74px_92px_102px] gap-2 px-3 py-2 text-[12px]">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1d1d1f]">{ms.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#86868b]">{ms.taskDescription || `${ms.points}pt`}</p>
                </div>
                <span className="text-right tabular-nums text-[#3c3c43]">{ms.plannedShare == null ? "未設定" : `${Math.round(ms.plannedShare * 100)}%`}</span>
                <span className="text-right tabular-nums text-[#3c3c43]">
                  {ms.progressPct == null ? "未生成" : `${ms.progressPct.toFixed(1)}%`}
                  {ms.monthlyProgressPct != null && ms.monthlyProgressPct > 0 && (
                    <span className="block text-[10px] text-[#86868b]">+{ms.monthlyProgressPct.toFixed(1)}pt</span>
                  )}
                </span>
                <span className="text-right tabular-nums font-semibold text-[#3c3c43]">{formatYen(ms.expectedRewardYen)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
