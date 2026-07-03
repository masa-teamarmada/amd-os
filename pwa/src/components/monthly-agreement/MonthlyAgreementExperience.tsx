"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDollarSign, FileCheck2, ListChecks, Loader2, RefreshCw, Send } from "lucide-react";
import { Hint } from "@/components/ui/Hint";
import type { MonthlyWorkAgreementBundle, MonthlyWorkAgreementProject } from "@/lib/monthly-work-agreement-types";

export function currentYmJst() {
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

function formatPt(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "算定待ち";
  return `${(Math.round(value * 10) / 10).toLocaleString()}pt`;
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

type MonthlyAgreementMode = "page" | "modal";

type MonthlyAgreementExperienceProps = {
  mode?: MonthlyAgreementMode;
  initialYm?: string;
  initialMemberId?: string;
  initialBundle?: MonthlyWorkAgreementBundle | null;
  onResolved?: () => void;
};

export function MonthlyAgreementLoading({ mode = "page" }: { mode?: MonthlyAgreementMode }) {
  return (
    <div className={`${mode === "modal" ? "min-h-[360px]" : "min-h-screen"} grid place-items-center bg-[#f5f5f7]`}>
      <div className="flex items-center gap-2 text-sm text-[#6e6e73]">
        <Loader2 className="size-4 animate-spin" />
        読み込み中
      </div>
    </div>
  );
}

export function MonthlyAgreementExperience({
  mode = "page",
  initialYm,
  initialMemberId = "",
  initialBundle = null,
  onResolved,
}: MonthlyAgreementExperienceProps) {
  const ym = initialBundle?.ym || initialYm || currentYmJst();
  const memberId = initialBundle?.member.memberId || initialMemberId;
  const [bundle, setBundle] = useState<MonthlyWorkAgreementBundle | null>(initialBundle);
  const [loading, setLoading] = useState(!initialBundle);
  const [saving, setSaving] = useState(false);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestBody, setRequestBody] = useState("");
  const [requestProjectId, setRequestProjectId] = useState("");
  const [requestType, setRequestType] = useState("scope_or_goal");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const skipInitialLoadRef = useRef(Boolean(initialBundle));
  const isModal = mode === "modal";

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
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
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
      if (payload.bundle.status === "agreed" || payload.bundle.status === "not_required") {
        onResolved?.();
      }
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

  if (loading) return <MonthlyAgreementLoading mode={mode} />;

  if (error || !bundle) {
    return (
      <div className={`${isModal ? "min-h-[360px]" : "min-h-screen"} bg-[#f5f5f7] px-4 py-8`}>
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
  const paidActualYen = bundle.snapshot.totals.paidActualYen ?? 0;
  const unverifiedPaidYen = bundle.snapshot.totals.unverifiedPaidYen ?? 0;
  const futurePayoutYen = bundle.snapshot.totals.futurePayoutYen ?? 0;
  const metricCount = 4 + (unverifiedPaidYen > 0 ? 1 : 0) + (totalStockYen > 0 ? 1 : 0);
  const metricCols = metricCount >= 6 ? "lg:grid-cols-6" : metricCount === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";

  return (
    <div className={`${isModal ? "h-full min-h-0 overflow-y-auto" : "min-h-screen pb-12"} bg-[#f5f5f7]`}>
      <div className={`${isModal ? "sticky top-0 z-10" : ""} border-b border-[#e5e5e7] bg-white px-4 py-5`}>
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#86868b]">Monthly Agreement</p>
            <h1 className="mt-1 text-[22px] font-semibold text-[#1d1d1f]">{formatYm(bundle.ym)}の遂行内容と予定報酬</h1>
            <p className="mt-1 text-[13px] text-[#6e6e73]">
              {bundle.member.codeName} / snapshot {bundle.currentHash.slice(0, 10)}
            </p>
          </div>
          {isModal ? (
            <p className="max-w-sm text-[12px] leading-relaxed text-[#6e6e73]">
              合意が完了すると、このロックは自動で外れます。
            </p>
          ) : (
            <Link href="/mypage" className="text-sm font-semibold text-[#007aff]">マイページへ</Link>
          )}
        </div>
      </div>

      <main className={`mx-auto flex max-w-5xl flex-col gap-5 px-4 ${isModal ? "py-5" : "mt-6"}`}>
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

        <AgreementFlowRail />

        <section className={`grid gap-3 sm:grid-cols-2 ${metricCols}`}>
          <MetricCard label="参加PJ" value={`${bundle.snapshot.totals.projectCount}`} hintId="monthly-agreement.project-count" />
          <MetricCard
            label="予定報酬合計"
            value={formatYen(bundle.snapshot.totals.expectedRewardYen)}
            hintId="monthly-agreement.expected-reward"
            description="月初に合意する、今月のMSコミットに対する予定額"
          />
          <MetricCard
            label="支払済み実績(税込)"
            value={formatYen(paidActualYen)}
            hintId="monthly-agreement.payout"
          />
          {unverifiedPaidYen > 0 && (
            <MetricCard
              label="実績未照合(税込)"
              value={formatYen(unverifiedPaidYen)}
              emphasis
              hintId="monthly-agreement.payout"
            />
          )}
          <MetricCard
            label="これから支払予定(税込)"
            value={formatYen(futurePayoutYen)}
            hintId="monthly-agreement.payout"
          />
          {totalStockYen > 0 && (
            <MetricCard
              label="未払いストック残"
              value={formatYen(totalStockYen)}
              emphasis
              hintId="monthly-agreement.stock"
              description="今月は支払われず、翌月以降へ残る残高"
            />
          )}
        </section>

        <section className="rounded-lg border border-[#e5e5e7] bg-white p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">修正要望</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73]">
                担当MS、到達目標、予定報酬が違う場合はここから送ってください。<Hint id="monthly-agreement.revision-request" />
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
            bundle.snapshot.projects.map((project) => (
              <ProjectAgreementCard
                key={project.projectId}
                project={project}
                ym={bundle.ym}
                viewerIsAdmin={Boolean(bundle.member.isAdmin)}
                linksInNewTab={isModal}
              />
            ))
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

function AgreementFlowRail() {
  const steps = [
    {
      key: "agreement",
      icon: <FileCheck2 className="size-4" />,
      label: "月初合意",
      body: "今月の遂行対象、到達目標、予定報酬をsnapshotで残す",
    },
    {
      key: "ms",
      icon: <ListChecks className="size-4" />,
      label: "MS pt",
      body: "シーズンMSのpt、今月予定進捗、担当割合で予定額を作る",
    },
    {
      key: "payout",
      icon: <CircleDollarSign className="size-4" />,
      label: "支払ゲート",
      body: "未合意・条件更新・修正要望中は支払通知へ進ませない",
    },
  ];
  return (
    <section className="rounded-lg border border-[#e5e5e7] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-semibold text-[#1d1d1f]">
            合意から支払までの流れ <Hint id="monthly-agreement.flow" />
          </h2>
          <p className="mt-1 text-[12px] text-[#6e6e73]">予定報酬と実際の支払は、同じ線上にあるけど別の確認レイヤー。</p>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.key} className="relative rounded-md border border-[#e5e5e7] bg-[#fbfbfd] p-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1d1d1f]">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-white text-[#007aff] ring-1 ring-[#d1d1d6]">
                {step.icon}
              </span>
              {step.label}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#6e6e73]">{step.body}</p>
            {index < steps.length - 1 && (
              <ArrowRight className="absolute right-3 top-3 hidden size-4 text-[#c7c7cc] md:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  emphasis = false,
  hintId,
  description,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  hintId?: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-[#e5e5e7] bg-white p-4">
      <p className="text-[12px] font-semibold text-[#86868b]">
        {label} {hintId && <Hint id={hintId} />}
      </p>
      <p className={`mt-2 text-[24px] font-semibold tabular-nums ${emphasis ? "text-amber-700" : "text-[#1d1d1f]"}`}>{value}</p>
      {description && <p className="mt-1 text-[11px] leading-relaxed text-[#86868b]">{description}</p>}
    </div>
  );
}

function ProjectAgreementCard({
  project,
  ym,
  viewerIsAdmin,
  linksInNewTab,
}: {
  project: MonthlyWorkAgreementProject;
  ym: string;
  viewerIsAdmin: boolean;
  linksInNewTab: boolean;
}) {
  const stockYen = project.stockYen ?? 0;
  const hasStock = stockYen > 0;
  const currentMonthPayoutYen = project.payoutYen ?? 0;
  const scheduledPayoutYen = project.currentCyclePayoutYen;
  const hasPayout = currentMonthPayoutYen > 0;
  const hasScheduledPayout = scheduledPayoutYen != null && scheduledPayoutYen > 0;
  const currentCyclePaysThisMonth = hasScheduledPayout && project.paymentYm === ym;
  const headlineValue = project.expectedRewardYen ?? null;
  const carryInYen = project.carryInYen ?? 0;
  const currentDueYen = project.grossDueYen == null ? null : Math.max(0, project.grossDueYen - carryInYen);
  const showStockBreakdown =
    hasStock && (carryInYen > 0 || currentDueYen != null || hasPayout || hasScheduledPayout);
  const payoutSchedule = project.payoutSchedule ?? [];
  const cockpitHref = `/project/${project.projectId}/cockpit?ym=${encodeURIComponent(ym)}`;
  const msOverviewHref = `/admin/ms-overview?projectId=${encodeURIComponent(project.projectId)}`;
  const linkTargetProps = linksInNewTab ? { target: "_blank", rel: "noreferrer" } : {};
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              href={cockpitHref}
              {...linkTargetProps}
              className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
            >
              今シーズンのMSリストへ
              <ArrowRight className="size-3" />
            </Link>
            {viewerIsAdmin && (
              <Link
                href={msOverviewHref}
                {...linkTargetProps}
                className="inline-flex items-center gap-1 rounded-md border border-[#d1d1d6] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#3c3c43] hover:bg-[#f5f5f7]"
              >
                MS設計レビューへ
                <ArrowRight className="size-3" />
              </Link>
            )}
            <Hint id="monthly-agreement.ms-link" />
          </div>
        </div>
        <div className={`rounded-md border px-3 py-2 text-right ${hasStock ? "border-amber-200 bg-amber-50" : "border-transparent bg-[#f5f5f7]"}`}>
          <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-[#86868b]">
            <CircleDollarSign className="size-3.5" />
            予定報酬 <Hint id="monthly-agreement.expected-reward" />
          </div>
          <p className="mt-1 text-[20px] font-semibold tabular-nums text-[#1d1d1f]">
            {formatYen(headlineValue)}
          </p>
          {hasScheduledPayout && project.paymentYm ? (
            <p className="mt-1 text-[10px] tabular-nums text-[#86868b]">
              この稼働月ぶんの支払予定 {formatYm(project.paymentYm)} {formatYen(scheduledPayoutYen)}
            </p>
          ) : null}
          {hasPayout && !currentCyclePaysThisMonth ? (
            <p className="mt-1 text-[10px] tabular-nums text-[#86868b]">
              今月支払（別稼働月分） {formatYen(currentMonthPayoutYen)}
            </p>
          ) : null}
          {hasStock && (
            <div className="mt-2 border-t border-amber-200 pt-2 text-left">
              <p className="text-[10px] font-semibold text-amber-800">
                支払予定後の未払い残 <Hint id="monthly-agreement.stock" />
              </p>
              <p className="mt-0.5 text-right text-[16px] font-semibold tabular-nums text-amber-800">{formatYen(stockYen)}</p>
              {showStockBreakdown && (
                <dl className="mt-1.5 space-y-0.5 text-[10px] text-[#86868b]">
                  {carryInYen > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <dt>前回からの繰越</dt>
                      <dd className="tabular-nums">{formatYen(carryInYen)}</dd>
                    </div>
                  )}
                  {currentDueYen != null && (
                    <div className="flex items-center justify-between gap-3">
                      <dt>この稼働月の発生</dt>
                      <dd className="tabular-nums">{formatYen(currentDueYen)}</dd>
                    </div>
                  )}
                  {hasPayout && (
                    <div className="flex items-center justify-between gap-3">
                      <dt>今月支払</dt>
                      <dd className="tabular-nums">-{formatYen(currentMonthPayoutYen)}</dd>
                    </div>
                  )}
                  {!currentCyclePaysThisMonth && hasScheduledPayout && project.paymentYm && (
                    <div className="flex items-center justify-between gap-3">
                      <dt>{formatYm(project.paymentYm)}支払予定</dt>
                      <dd className="tabular-nums">{formatYen(scheduledPayoutYen)}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          )}
          {hasStock && project.grossDueYen != null && (
            <p className="mt-1 text-[10px] tabular-nums text-[#86868b]">支払対象額（繰越含む） {formatYen(project.grossDueYen)}</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <ConceptPill
          label="月初の約束"
          value={formatYen(headlineValue)}
          hintId="monthly-agreement.expected-reward"
          tone="sky"
        />
        <ConceptPill
          label="支払状態"
          value={hasScheduledPayout ? `${project.paymentYm ? formatYm(project.paymentYm) : ""} ${formatYen(scheduledPayoutYen)}` : hasPayout ? `今月支払 ${formatYen(currentMonthPayoutYen)}` : "支払予定なし"}
          hintId="monthly-agreement.payout"
          tone="emerald"
        />
        <ConceptPill
          label="支払後残"
          value={formatYen(stockYen)}
          hintId="monthly-agreement.stock"
          tone={hasStock ? "amber" : "plain"}
        />
      </div>

      {(project.reviewReasons.length > 0 || project.conditions.length > 0) && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          {project.reviewReasons.length > 0 && (
            <p className="font-semibold">要確認: {project.reviewReasons.join(" / ")}</p>
          )}
          {project.conditions.length > 0 && (
            <p className={project.reviewReasons.length > 0 ? "mt-1" : undefined}>条件: {project.conditions.join(" / ")}</p>
          )}
        </div>
      )}

      {payoutSchedule.length > 0 && (
        <PayoutScheduleTable rows={payoutSchedule} />
      )}

      {project.milestones.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-md border border-[#e5e5e7]">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f5f5f7] px-3 py-2">
            <h3 className="text-[12px] font-semibold text-[#3c3c43]">
              担当MSとpt内訳 <Hint id="monthly-agreement.ms-pt" />
            </h3>
            <Link href={cockpitHref} {...linkTargetProps} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007aff]">
              PJ cockpitでMSを見る
              <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[minmax(220px,1.4fr)_86px_110px_94px_112px] bg-white px-3 py-2 text-[11px] font-semibold text-[#6e6e73]">
                <span>遂行対象</span>
                <span className="text-right">担当割合</span>
                <span className="text-right">累積/今月</span>
                <span className="text-right">今月pt</span>
                <span className="text-right">予定報酬</span>
              </div>
              <div className="divide-y divide-[#e5e5e7]">
                {project.milestones.map((ms) => {
                  const shareLabel = ms.plannedShare == null ? "未設定" : `${Math.round(ms.plannedShare * 100)}%`;
                  return (
                    <div key={ms.milestoneId} className="grid grid-cols-[minmax(220px,1.4fr)_86px_110px_94px_112px] gap-2 px-3 py-2 text-[12px]">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#1d1d1f]">{ms.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[#86868b]">
                          {ms.taskDescription || `${formatPt(ms.points)}のMS`}
                        </p>
                      </div>
                      <span className="text-right tabular-nums text-[#3c3c43]">{shareLabel}</span>
                      <span className="text-right tabular-nums text-[#3c3c43]">
                        {ms.progressPct == null ? "未生成" : `${ms.progressPct.toFixed(1)}%`}
                        {ms.monthlyProgressPct != null && ms.monthlyProgressPct > 0 && (
                          <span className="block text-[10px] text-[#86868b]">+{ms.monthlyProgressPct.toFixed(1)}pt</span>
                        )}
                      </span>
                      <span className="text-right tabular-nums text-[#3c3c43]">{formatPt(ms.earnedPt)}</span>
                      <span className="text-right tabular-nums font-semibold text-[#3c3c43]">{formatYen(ms.expectedRewardYen)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function ConceptPill({
  label,
  value,
  hintId,
  tone,
}: {
  label: string;
  value: string;
  hintId: string;
  tone: "sky" | "emerald" | "amber" | "plain";
}) {
  const toneClass =
    tone === "sky"
      ? "border-sky-200 bg-sky-50 text-sky-950"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-[#e5e5e7] bg-[#fbfbfd] text-[#3c3c43]";
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-semibold">
        {label} <Hint id={hintId} />
      </p>
      <p className="mt-1 truncate text-[13px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function PayoutScheduleTable({ rows }: { rows: MonthlyWorkAgreementProject["payoutSchedule"] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-[#e5e5e7]">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f5f5f7] px-3 py-2">
        <h3 className="text-[12px] font-semibold text-[#3c3c43]">
          未払いストックの流れ <Hint id="monthly-agreement.stock-flow" />
        </h3>
        <span className="text-[10px] text-[#86868b]">新規発生 + 繰越 → 支払額 → 支払後残</span>
      </div>
      <PayoutFlowBars rows={rows} />
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-[11px]">
          <thead className="bg-white text-[#6e6e73]">
            <tr className="border-b border-[#e5e5e7]">
              <th className="px-3 py-2 text-left font-semibold">稼働月</th>
              <th className="px-3 py-2 text-right font-semibold">新規発生</th>
              <th className="px-3 py-2 text-right font-semibold">支払対象</th>
              <th className="px-3 py-2 text-right font-semibold">支払額</th>
              <th className="px-3 py-2 text-right font-semibold">支払後残</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e5e7]">
            {rows.map((row) => (
              <tr key={`${row.sourceYm}:${row.paymentYm}`} className={row.isCurrentYm ? "bg-amber-50/70" : undefined}>
                <td className="px-3 py-2 align-top">
                  <div className="font-semibold text-[#1d1d1f]">{formatYm(row.sourceYm)}</div>
                  {row.isCurrentYm && <div className="text-[10px] font-semibold text-amber-800">今回の合意対象</div>}
                </td>
                <td className="px-3 py-2 text-right align-top tabular-nums">
                  <div className="font-semibold text-[#3c3c43]">{formatYen(row.basePayYen)}</div>
                </td>
                <td className="px-3 py-2 text-right align-top tabular-nums">
                  <div className="font-semibold text-[#3c3c43]">{formatYen(row.grossDueYen)}</div>
                  {row.carryInYen > 0 && <div className="text-[10px] text-[#86868b]">繰越 {formatYen(row.carryInYen)}</div>}
                </td>
                <td className="px-3 py-2 text-right align-top tabular-nums">
                  <div className="font-semibold text-[#1d1d1f]">税抜 {formatYen(row.totalPayYen)}</div>
                  <div className="text-[10px] text-[#86868b]">税込 {formatYen(row.totalPayTaxIncludedYen)}</div>
                  <div className="text-[10px] text-[#86868b]">{formatYm(row.paymentYm)}</div>
                  <PayoutSourceBadge row={row} />
                </td>
                <td className="px-3 py-2 text-right align-top tabular-nums">
                  <div className={row.stockYen > 0 ? "font-semibold text-amber-800" : "text-[#86868b]"}>
                    {formatYen(row.stockYen)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function payoutSourceLabel(row: MonthlyWorkAgreementProject["payoutSchedule"][number]) {
  if (row.amountSource === "actual_paid") return "支払実績";
  if (row.amountSource === "unverified_paid") return "要照合";
  if (row.amountSource === "payout_snapshot") return "保存済み";
  if (row.amountSource === "protected_reward_cache") return "保護済み";
  return "予定";
}

function PayoutSourceBadge({ row }: { row: MonthlyWorkAgreementProject["payoutSchedule"][number] }) {
  const label = payoutSourceLabel(row);
  const cls = row.isActualPaid
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : row.amountSource === "unverified_paid"
      ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-[#d1d1d6] bg-white text-[#6e6e73]";
  return (
    <div className="mt-1">
      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
    </div>
  );
}

function PayoutFlowBars({ rows }: { rows: MonthlyWorkAgreementProject["payoutSchedule"] }) {
  const maxGrossDueYen = Math.max(1, ...rows.map((row) => row.grossDueYen));
  const currentSourceYm = rows.find((item) => item.isCurrentYm)?.sourceYm ?? null;
  const chartRows = currentSourceYm
    ? rows.filter((row) => row.isCurrentYm || row.sourceYm >= currentSourceYm)
    : rows;
  const visibleRows = chartRows.length > 0 ? chartRows : rows;
  return (
    <div className="border-b border-[#e5e5e7] bg-white p-3">
      <div className="mb-2 flex flex-wrap gap-2 text-[10px] text-[#6e6e73]">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-[#d1d1d6]" />繰越</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-sky-300" />新規発生</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-400" />支払額</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-amber-300" />支払後残</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[680px] space-y-2">
          {visibleRows.map((row) => (
            <PayoutFlowBarRow key={`${row.sourceYm}:${row.paymentYm}`} row={row} maxGrossDueYen={maxGrossDueYen} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PayoutFlowBarRow({
  row,
  maxGrossDueYen,
}: {
  row: MonthlyWorkAgreementProject["payoutSchedule"][number];
  maxGrossDueYen: number;
}) {
  const grossDueYen = Math.max(1, row.grossDueYen);
  const barWidthPct = Math.max(4, Math.min(100, (grossDueYen / maxGrossDueYen) * 100));
  const carryPct = Math.min(100, (row.carryInYen / grossDueYen) * 100);
  const basePct = Math.min(100, (row.basePayYen / grossDueYen) * 100);
  const paidPct = Math.min(100, (row.totalPayYen / grossDueYen) * 100);
  const stockPct = Math.min(100, (row.stockYen / grossDueYen) * 100);
  return (
    <div className={`grid grid-cols-[92px_minmax(0,1fr)_190px] items-center gap-3 rounded px-2 py-2 ${row.isCurrentYm ? "bg-amber-50" : "bg-white"}`}>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-[#1d1d1f]">{formatYm(row.sourceYm)}</div>
        <div className="text-[10px] text-[#86868b]">{formatYm(row.paymentYm)}支払</div>
      </div>
      <div className="space-y-1">
        <div className="h-3 rounded-r-full bg-[#f5f5f7]" style={{ width: `${barWidthPct}%` }}>
          <div className="flex h-full overflow-hidden rounded-r-full">
            <div className="bg-[#d1d1d6]" style={{ width: `${carryPct}%` }} />
            <div className="bg-sky-300" style={{ width: `${basePct}%` }} />
          </div>
        </div>
        <div className="h-3 rounded-r-full bg-[#f5f5f7]" style={{ width: `${barWidthPct}%` }}>
          <div className="flex h-full overflow-hidden rounded-r-full">
            <div className="bg-emerald-400" style={{ width: `${paidPct}%` }} />
            <div className="bg-amber-300" style={{ width: `${stockPct}%` }} />
          </div>
        </div>
      </div>
      <div className="text-right text-[10px] leading-tight text-[#6e6e73] tabular-nums">
        <div>新規 {formatYen(row.basePayYen)} / 支払 {formatYen(row.totalPayYen)} ({payoutSourceLabel(row)})</div>
        <div>対象 {formatYen(row.grossDueYen)} / 残 {formatYen(row.stockYen)}</div>
      </div>
    </div>
  );
}
