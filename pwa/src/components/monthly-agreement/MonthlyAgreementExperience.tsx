"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  ListChecks,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";
import { Hint } from "@/components/ui/Hint";
import type {
  MonthlyWorkAgreementBundle,
  MonthlyWorkAgreementProject,
} from "@/lib/monthly-work-agreement-types";

export function currentYmJst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatYm(ym: string) {
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function formatYen(value: number | null | undefined) {
  if (value == null) return "まだ計算なし";
  return `¥${Math.round(value).toLocaleString()}`;
}

function formatPt(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value))
    return "まだ計算なし";
  return `${(Math.round(value * 10) / 10).toLocaleString()}pt`;
}

function statusLabel(status: MonthlyWorkAgreementBundle["status"]) {
  if (status === "agreed") return "合意済み";
  if (status === "needs_reagreement") return "内容が更新されています";
  if (status === "not_required") return "確認不要";
  return "未確認";
}

function statusClass(status: MonthlyWorkAgreementBundle["status"]) {
  if (status === "agreed")
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "needs_reagreement")
    return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "not_required")
    return "border-[#d1d1d6] bg-white text-[#3c3c43]";
  return "border-sky-200 bg-sky-50 text-sky-950";
}

function agreementStatusMessage(bundle: MonthlyWorkAgreementBundle) {
  if (bundle.status === "agreed") {
    return `確認した日時: ${bundle.latestAgreement?.agreedAt ? new Date(bundle.latestAgreement.agreedAt).toLocaleString("ja-JP") : "記録済み"}`;
  }
  if (bundle.status === "needs_reagreement") {
    return "前に確認したあとで、担当内容・到達目標か予定額が変わりました。下の必須2点を見直して、問題なければ合意してください。";
  }
  if (bundle.status === "not_required") {
    return bundle.exclusionReason || "この月の月初合意は不要です。";
  }
  return "下の必須2点を確認して、問題なければ合意してください。";
}

function formatBillingStatus(status: string | null | undefined) {
  if (!status) return "未作成";
  const labels: Record<string, string> = {
    not_started: "未開始",
    budget_reported: "予算入力済み",
    budget_confirmed: "予算確認済み",
    report_fixed: "報告書確定",
    invoice_issued: "請求書作成済み",
    invoice_sent: "請求書送付済み",
    payment_confirmed: "入金確認済み",
    reward_paid: "報酬支払い済み",
    confirmed: "確認済み",
    reported: "入力済み",
    not_set: "未設定",
  };
  return labels[status] || "確認中";
}

type MonthlyAgreementMode = "page" | "modal";

type MonthlyAgreementExperienceProps = {
  mode?: MonthlyAgreementMode;
  initialYm?: string;
  initialMemberId?: string;
  initialBundle?: MonthlyWorkAgreementBundle | null;
  onResolved?: () => void;
};

export function MonthlyAgreementLoading({
  mode = "page",
}: {
  mode?: MonthlyAgreementMode;
}) {
  return (
    <div
      className={`${mode === "modal" ? "min-h-[360px]" : "min-h-screen"} grid place-items-center bg-[#f5f5f7]`}
    >
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
  const [bundle, setBundle] = useState<MonthlyWorkAgreementBundle | null>(
    initialBundle,
  );
  const [loading, setLoading] = useState(!initialBundle);
  const [saving, setSaving] = useState(false);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestBody, setRequestBody] = useState("");
  const [requestProjectId, setRequestProjectId] = useState("");
  const [requestType, setRequestType] = useState("scope_or_goal");
  const [revisionOpen, setRevisionOpen] = useState(false);
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
      const res = await fetch(
        `/api/monthly-work-agreement?${params.toString()}`,
        { cache: "no-store" },
      );
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        bundle?: MonthlyWorkAgreementBundle;
        error?: string;
      };
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
        body: JSON.stringify({
          ym: bundle.ym,
          memberId: bundle.member.memberId,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        bundle?: MonthlyWorkAgreementBundle;
        error?: string;
      };
      if (!res.ok || payload.ok === false || !payload.bundle) {
        throw new Error(payload.error || `保存に失敗 (${res.status})`);
      }
      setBundle(payload.bundle);
      if (
        payload.bundle.status === "agreed" ||
        payload.bundle.status === "not_required"
      ) {
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
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        bundle?: MonthlyWorkAgreementBundle;
        error?: string;
      };
      if (!res.ok || payload.ok === false || !payload.bundle) {
        throw new Error(payload.error || `保存に失敗 (${res.status})`);
      }
      setBundle(payload.bundle);
      setRequestBody("");
      setRequestProjectId("");
      setRequestType("scope_or_goal");
      setRevisionOpen(true);
      setRequestMessage("送信しました。管理側で確認します。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRequestSaving(false);
    }
  };

  if (loading) return <MonthlyAgreementLoading mode={mode} />;

  if (error || !bundle) {
    return (
      <div
        className={`${isModal ? "min-h-[360px]" : "min-h-screen"} bg-[#f5f5f7] px-4 py-8`}
      >
        <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700">
          {error || "データ取得に失敗しました"}
          <button
            onClick={load}
            className="ml-3 rounded-md border border-red-200 px-3 py-1 text-xs font-semibold"
          >
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
  const metricCount =
    4 + (unverifiedPaidYen > 0 ? 1 : 0) + (totalStockYen > 0 ? 1 : 0);
  const summaryCols = metricCount >= 5 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  const contentWidth = isModal ? "max-w-7xl" : "max-w-5xl";

  return (
    <div
      className={`${isModal ? "h-full min-h-0 overflow-y-auto" : "min-h-screen pb-12"} bg-[#f5f5f7]`}
    >
      <div
        className={`${isModal ? "sticky top-0 z-10 px-3 py-3" : "px-4 py-5"} border-b border-[#e5e5e7] bg-white`}
      >
        <div
          className={`mx-auto flex ${contentWidth} flex-col gap-3 sm:flex-row sm:items-end sm:justify-between`}
        >
          <div>
            <p
              className={`${isModal ? "text-[10px]" : "text-[11px]"} font-semibold tracking-[0.16em] text-[#86868b]`}
            >
              月初合意
            </p>
            <h1
              className={`${isModal ? "text-[18px]" : "text-[22px]"} mt-1 font-semibold text-[#1d1d1f]`}
            >
              {formatYm(bundle.ym)}の発注条件と予定額
            </h1>
            <p
              className={`${isModal ? "text-[12px]" : "text-[13px]"} mt-1 text-[#6e6e73]`}
            >
              {bundle.member.codeName} / 記録ID{" "}
              {bundle.currentHash.slice(0, 10)}
            </p>
          </div>
          {isModal ? (
            <p className="max-w-sm text-[11px] leading-relaxed text-[#6e6e73]">
              確認して合意すると、この画面は自動で閉じます。
            </p>
          ) : (
            <Link
              href="/mypage"
              className="text-sm font-semibold text-[#007aff]"
            >
              マイページへ
            </Link>
          )}
        </div>
      </div>

      <main
        className={`mx-auto flex ${contentWidth} flex-col px-3 sm:px-4 ${isModal ? "gap-3 py-3" : "mt-6 gap-5"}`}
      >
        <section
          className={
            isModal
              ? "flex max-w-full flex-wrap items-start gap-2"
              : `grid gap-3 sm:grid-cols-2 ${summaryCols}`
          }
        >
          <div
            className={`rounded-lg border ${isModal ? "min-w-[360px] flex-[1_1_520px] p-2.5 md:max-w-[640px]" : "p-4"} ${statusClass(bundle.status)}`}
          >
            <div
              className={`${isModal ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2" : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"}`}
            >
              <div
                className={`flex min-w-0 items-start ${isModal ? "gap-2" : "gap-2.5"}`}
              >
                {bundle.status === "agreed" ? (
                  <CheckCircle2 className="mt-0.5 size-4" />
                ) : (
                  <FileCheck2 className="mt-0.5 size-4" />
                )}
                <div className="min-w-0">
                  <p
                    className={`${isModal ? "text-[13px]" : "text-sm"} font-semibold`}
                  >
                    {statusLabel(bundle.status)}
                  </p>
                  <p
                    className={`${isModal ? "mt-0.5 text-[11px]" : "mt-1 text-xs"} leading-relaxed`}
                  >
                    {agreementStatusMessage(bundle)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setRequestMessage(null);
                    setRevisionOpen(true);
                  }}
                  disabled={!bundle.canAgree}
                  className={`${isModal ? "h-8 px-2.5 text-xs" : "px-3 py-2 text-sm"} inline-flex items-center justify-center gap-1.5 rounded-md border border-current/30 bg-white/65 font-semibold disabled:cursor-not-allowed disabled:opacity-50`}
                  title={
                    !bundle.canAgree
                      ? bundle.exclusionReason || "本人だけが修正要望を送れます"
                      : "担当内容・到達目標、または予定額の修正要望を送る"
                  }
                >
                  <Send className="size-3.5" />
                  修正要望
                </button>
                <button
                  type="button"
                  onClick={handleAgree}
                  disabled={
                    saving ||
                    bundle.status === "agreed" ||
                    !bundle.tableReady ||
                    !bundle.canAgree
                  }
                  className={`${isModal ? "h-8 px-3 text-xs" : "px-3 py-2 text-sm"} inline-flex items-center justify-center gap-2 rounded-md bg-[#1d1d1f] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50`}
                  title={
                    !bundle.canAgree
                      ? bundle.exclusionReason || "本人だけが合意できます"
                      : "担当内容・到達目標と予定額を確認して合意"
                  }
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileCheck2 className="size-4" />
                  )}
                  {bundle.status === "agreed"
                    ? "合意済み"
                    : bundle.status === "not_required"
                      ? "確認不要"
                      : "確認して合意"}
                </button>
              </div>
            </div>
            {bundle.status !== "agreed" && bundle.status !== "not_required" && (
              <p
                className={`${isModal ? "mt-1 text-right text-[10px]" : "mt-2 text-xs"} font-semibold text-amber-900`}
              >
                「確認して合意」を押すまで、この月の支払いには進めません。
              </p>
            )}
            {!bundle.tableReady && (
              <p
                className={`${isModal ? "mt-2 px-2 py-1 text-[11px]" : "mt-3 px-3 py-2 text-xs"} rounded-md border border-red-200 bg-white/70 text-red-700`}
              >
                保存に必要な準備がまだ終わっていません。準備が終わると合意できます。
              </p>
            )}
            {revisionOpen && (
              <section
                aria-labelledby="monthly-agreement-revision-heading"
                className={`${isModal ? "mt-2 pt-2" : "mt-4 pt-3"} border-t border-current/20`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2
                      id="monthly-agreement-revision-heading"
                      className={`${isModal ? "text-[12px]" : "text-sm"} font-semibold`}
                    >
                      修正要望
                    </h2>
                    <p
                      className={`${isModal ? "mt-0.5 text-[10px]" : "mt-1 text-xs"} leading-relaxed opacity-80`}
                    >
                      担当内容・到達目標、予定額に違いがあるときだけ送ってください。
                      <Hint id="monthly-agreement.revision-request" />
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRevisionOpen(false)}
                    className="text-[11px] font-semibold opacity-75 hover:opacity-100"
                  >
                    閉じる
                  </button>
                </div>
                <div
                  className={`${isModal ? "mt-2 grid gap-1.5 sm:grid-cols-2" : "mt-3 grid gap-2 sm:grid-cols-[160px_180px_minmax(0,1fr)]"}`}
                >
                  <select
                    value={requestType}
                    onChange={(event) => setRequestType(event.target.value)}
                    disabled={!bundle.canAgree}
                    className={`${isModal ? "h-8 py-1 text-xs" : "py-2 text-sm"} min-w-0 rounded-md border border-current/25 bg-white/80 px-2 text-[#1d1d1f]`}
                  >
                    <option value="scope_or_goal">担当内容・目標</option>
                    <option value="reward">予定額</option>
                    <option value="other">その他</option>
                  </select>
                  <select
                    value={requestProjectId}
                    onChange={(event) =>
                      setRequestProjectId(event.target.value)
                    }
                    disabled={!bundle.canAgree}
                    className={`${isModal ? "h-8 py-1 text-xs" : "py-2 text-sm"} min-w-0 rounded-md border border-current/25 bg-white/80 px-2 text-[#1d1d1f]`}
                  >
                    <option value="">全体</option>
                    {bundle.snapshot.projects.map((project) => (
                      <option key={project.projectId} value={project.projectId}>
                        {project.projectName}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={requestBody}
                    onChange={(event) => setRequestBody(event.target.value)}
                    disabled={!bundle.canAgree}
                    rows={isModal ? 2 : 3}
                    className={`${isModal ? "sm:col-span-2 text-xs" : "min-h-[84px] text-sm"} min-h-12 rounded-md border border-current/25 bg-white/80 px-3 py-2 text-[#1d1d1f] outline-none focus:border-[#007aff]`}
                    placeholder="例: この目標ではなく、登記準備を優先したい"
                  />
                </div>
                <div
                  className={`${isModal ? "mt-2" : "mt-3"} flex flex-wrap items-center justify-between gap-2`}
                >
                  <p
                    className={`${isModal ? "text-[10px]" : "text-[11px]"} opacity-75`}
                  >
                    送った時点の記録IDも一緒に残ります。
                  </p>
                  <button
                    type="button"
                    onClick={handleRevisionRequest}
                    disabled={
                      requestSaving ||
                      !bundle.canAgree ||
                      requestBody.trim().length < 4
                    }
                    className={`${isModal ? "h-8 px-3 text-xs" : "px-3 py-2 text-xs"} inline-flex items-center justify-center gap-1.5 rounded-md border border-current/40 bg-white/80 font-semibold text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {requestSaving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    送る
                  </button>
                </div>
                {requestMessage && (
                  <p className="mt-2 text-[12px] font-semibold text-emerald-800">
                    {requestMessage}
                  </p>
                )}
                {bundle.revisionRequests.length > 0 && (
                  <div className="mt-2 divide-y divide-current/15 border-t border-current/15 text-[11px]">
                    {bundle.revisionRequests.slice(0, 3).map((request) => (
                      <div key={request.id} className="py-1.5">
                        <span className="font-semibold">
                          {request.status === "open"
                            ? "対応中"
                            : request.status}
                        </span>
                        <span className="ml-2 opacity-75">
                          {request.projectId || "全体"}
                        </span>
                        <p className="mt-0.5 line-clamp-2 opacity-85">
                          {request.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
          {!isModal && (
            <MetricCard
              label="対象プロジェクト"
              value={`${bundle.snapshot.totals.projectCount}`}
              hintId="monthly-agreement.project-count"
            />
          )}
          {!isModal && (
            <MetricCard
              label="もらえる予定額"
              value={formatYen(bundle.snapshot.totals.expectedRewardYen)}
              hintId="monthly-agreement.expected-reward"
              description="今月やる仕事に対して、今の計画で見込んでいる金額"
            />
          )}
          {!isModal && (
            <MetricCard
              label="支払い済み"
              value={formatYen(paidActualYen)}
              hintId="monthly-agreement.payout"
            />
          )}
          {!isModal && unverifiedPaidYen > 0 && (
            <MetricCard
              label="支払い確認中"
              value={formatYen(unverifiedPaidYen)}
              emphasis
              hintId="monthly-agreement.payout"
            />
          )}
          {!isModal && (
            <MetricCard
              label="これから支払う予定"
              value={formatYen(futurePayoutYen)}
              hintId="monthly-agreement.payout"
            />
          )}
          {!isModal && totalStockYen > 0 && (
            <MetricCard
              label="まだ支払われていない残り"
              value={formatYen(totalStockYen)}
              emphasis
              hintId="monthly-agreement.stock"
              description="今月は支払われず、次の月以降に残る金額"
            />
          )}
        </section>

        <div
          className={isModal ? "flex max-w-full flex-col gap-2" : "contents"}
        >
          <AgreementFlowRail
            compact={isModal}
            projects={bundle.snapshot.projects}
            totalExpectedRewardYen={bundle.snapshot.totals.expectedRewardYen}
          />

          {isModal && (
            <section
              aria-labelledby="monthly-agreement-reference-heading"
              className="border-t border-[#d1d1d6] pt-2"
            >
              <h2
                id="monthly-agreement-reference-heading"
                className="text-[11px] font-semibold text-[#6e6e73]"
              >
                参考情報
                <span className="ml-2 font-normal">
                  担当内容・到達目標の詳細、予定額の根拠、支払い状況
                </span>
              </h2>
            </section>
          )}
        </div>

        {isModal && (
          <details className="w-full rounded-lg border border-[#e5e5e7] bg-white">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-2.5 py-2">
              <div>
                <span className="text-[10px] font-semibold text-[#86868b]">
                  参考情報
                </span>
                <h2 className="text-[13px] font-semibold text-[#1d1d1f]">
                  支払い状況と対象PJ
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-[#007aff]">
                開く
              </span>
            </summary>
            <div className="border-t border-[#e5e5e7] p-2.5">
              <p className="mb-2 text-[11px] leading-relaxed text-[#6e6e73]">
                支払い済み・支払予定・未払残は、合意する担当内容・到達目標や予定額そのものではなく、支払いの見通しを知るための情報です。
              </p>
              <div className="flex flex-wrap gap-2">
                <MetricCard
                  compact
                  label="対象PJ"
                  value={`${bundle.snapshot.totals.projectCount}`}
                  hintId="monthly-agreement.project-count"
                />
                <MetricCard
                  compact
                  label="支払済"
                  value={formatYen(paidActualYen)}
                  hintId="monthly-agreement.payout"
                />
                {unverifiedPaidYen > 0 && (
                  <MetricCard
                    compact
                    label="確認中"
                    value={formatYen(unverifiedPaidYen)}
                    emphasis
                    hintId="monthly-agreement.payout"
                  />
                )}
                <MetricCard
                  compact
                  label="支払予定"
                  value={formatYen(futurePayoutYen)}
                  hintId="monthly-agreement.payout"
                />
                {totalStockYen > 0 && (
                  <MetricCard
                    compact
                    label="未払残"
                    value={formatYen(totalStockYen)}
                    emphasis
                    hintId="monthly-agreement.stock"
                  />
                )}
              </div>
            </div>
          </details>
        )}

        <section
          className={`flex flex-col items-start ${isModal ? "gap-3" : "gap-4"}`}
        >
          {bundle.snapshot.projects.length === 0 ? (
            <div className="rounded-lg border border-[#e5e5e7] bg-white p-5 text-sm text-[#6e6e73]">
              {bundle.exclusionReason ||
                `${formatYm(bundle.ym)}に参加中のプロジェクトはありません。`}
            </div>
          ) : (
            bundle.snapshot.projects.map((project) => (
              <ProjectAgreementCard
                key={project.projectId}
                project={project}
                ym={bundle.ym}
                viewerIsAdmin={Boolean(bundle.member.isAdmin)}
                linksInNewTab={isModal}
                compact={isModal}
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

function AgreementFlowRail({
  compact = false,
  projects,
  totalExpectedRewardYen,
}: {
  compact?: boolean;
  projects: MonthlyWorkAgreementProject[];
  totalExpectedRewardYen: number | null | undefined;
}) {
  const steps = [
    {
      key: "agreement",
      icon: <FileCheck2 className="size-4" />,
      label: "担当内容・到達目標",
      body: "下のPJごとの詳細で、担当する内容と今月の到達目標に違いがないか確認する",
    },
    {
      key: "reward",
      icon: <ListChecks className="size-4" />,
      label: "予定額",
      body: "この枠の合計とPJごとの金額だけを、合意前に確認する",
    },
  ];
  return (
    <section
      className={`${compact ? "w-full max-w-full p-2.5" : "p-4"} rounded-lg border border-[#e5e5e7] bg-white`}
    >
      <div
        className={`${compact ? "mb-2" : "mb-3"} flex flex-wrap items-center justify-between gap-2`}
      >
        <div>
          <h2
            className={`${compact ? "text-[12px]" : "text-[14px]"} font-semibold text-[#1d1d1f]`}
          >
            合意前に必ず確認すること <Hint id="monthly-agreement.flow" />
          </h2>
          <p
            className={`${compact ? "mt-0.5 text-[11px]" : "mt-1 text-[12px]"} text-[#6e6e73]`}
          >
            担当内容・到達目標と、下の予定額に問題がなければ合意してください。pt・担当割合・支払い予定は参考情報です。
          </p>
        </div>
      </div>
      <div
        className={
          compact
            ? "grid max-w-full items-start gap-2 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
            : "grid gap-2 md:grid-cols-2"
        }
      >
        {steps.map((step) => (
          <div
            key={step.key}
            className={`relative rounded-md border border-[#e5e5e7] bg-[#fbfbfd] ${compact ? "min-w-0 p-2" : "p-3"}`}
          >
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1d1d1f]">
              <span
                className={`inline-flex ${compact ? "size-6" : "size-7"} items-center justify-center rounded-full bg-white text-[#007aff] ring-1 ring-[#d1d1d6]`}
              >
                {step.icon}
              </span>
              <span className="min-w-0 truncate">{step.label}</span>
              <span className="ml-auto rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-800">
                必須
              </span>
            </div>
            {step.key === "reward" ? (
              <dl className={`${compact ? "mt-1.5" : "mt-2"} space-y-1`}>
                <div className="flex items-baseline justify-between gap-3 rounded-md bg-white px-2 py-1">
                  <dt className="text-[10px] font-semibold text-[#6e6e73]">
                    予定額合計
                  </dt>
                  <dd className="text-[15px] font-semibold tabular-nums text-[#1d1d1f]">
                    {formatYen(totalExpectedRewardYen)}
                  </dd>
                </div>
                <div className="overflow-hidden rounded-md border border-[#dbeafe] bg-white">
                  <p className="border-b border-[#dbeafe] px-2 py-1 text-[10px] font-semibold text-sky-800">
                    PJごとの予定額
                  </p>
                  {projects.length === 0 ? (
                    <p className="px-2 py-1.5 text-[11px] text-[#6e6e73]">
                      対象PJはありません
                    </p>
                  ) : (
                    <div className="divide-y divide-[#e5e5e7]">
                      {projects.map((project) => (
                        <div
                          key={project.projectId}
                          className="flex items-center justify-between gap-3 px-2 py-1.5 text-[11px]"
                        >
                          <span className="min-w-0 truncate font-semibold text-[#3c3c43]">
                            {project.projectName}
                          </span>
                          <span className="whitespace-nowrap font-semibold tabular-nums text-[#1d1d1f]">
                            {formatYen(project.expectedRewardYen)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </dl>
            ) : (
              <p
                className={`${compact ? "mt-1" : "mt-2"} text-[11px] leading-relaxed text-[#6e6e73]`}
              >
                {step.body}
              </p>
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
  compact = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  hintId?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-[#e5e5e7] bg-white ${compact ? "min-w-[104px] flex-[0_0_112px] p-2" : "p-4"}`}
    >
      <p
        className={`${compact ? "text-[10px]" : "text-[12px]"} font-semibold text-[#86868b]`}
      >
        {label} {hintId && <Hint id={hintId} />}
      </p>
      <p
        className={`${compact ? "mt-0.5 text-[16px]" : "mt-2 text-[24px]"} font-semibold tabular-nums ${emphasis ? "text-amber-700" : "text-[#1d1d1f]"}`}
      >
        {value}
      </p>
      {description && (
        <p className="mt-1 text-[11px] leading-relaxed text-[#86868b]">
          {description}
        </p>
      )}
    </div>
  );
}

function ProjectAgreementCard({
  project,
  ym,
  viewerIsAdmin,
  linksInNewTab,
  compact = false,
}: {
  project: MonthlyWorkAgreementProject;
  ym: string;
  viewerIsAdmin: boolean;
  linksInNewTab: boolean;
  compact?: boolean;
}) {
  const stockYen = project.stockYen ?? 0;
  const hasStock = stockYen > 0;
  const currentMonthPayoutYen = project.payoutYen ?? 0;
  const scheduledPayoutYen = project.currentCyclePayoutYen;
  const hasPayout = currentMonthPayoutYen > 0;
  const hasScheduledPayout =
    scheduledPayoutYen != null && scheduledPayoutYen > 0;
  const currentCyclePaysThisMonth =
    hasScheduledPayout && project.paymentYm === ym;
  const headlineValue = project.expectedRewardYen ?? null;
  const carryInYen = project.carryInYen ?? 0;
  const currentDueYen =
    project.grossDueYen == null
      ? null
      : Math.max(0, project.grossDueYen - carryInYen);
  const showStockBreakdown =
    hasStock &&
    (carryInYen > 0 ||
      currentDueYen != null ||
      hasPayout ||
      hasScheduledPayout);
  const payoutSchedule = project.payoutSchedule ?? [];
  const hasPayoutSchedule = payoutSchedule.length > 0;
  const cockpitHref = `/project/${project.projectId}/cockpit?ym=${encodeURIComponent(ym)}`;
  const msOverviewHref = `/admin/ms-overview?projectId=${encodeURIComponent(project.projectId)}`;
  const linkTargetProps = linksInNewTab
    ? { target: "_blank", rel: "noreferrer" }
    : {};
  const hasMilestones = project.milestones.length > 0;
  const compactMilestoneGroups =
    compact && project.milestones.length > 5
      ? [
          project.milestones.slice(0, Math.ceil(project.milestones.length / 2)),
          project.milestones.slice(Math.ceil(project.milestones.length / 2)),
        ]
      : [project.milestones];
  const msGridCols = compact
    ? "grid-cols-[minmax(150px,1fr)_72px]"
    : "grid-cols-[minmax(220px,1.4fr)_86px_110px_94px_112px]";
  const msTableWidth = compact ? "w-full max-w-full" : "min-w-[760px]";
  return (
    <article
      className={`w-full max-w-full rounded-lg border border-[#e5e5e7] bg-white ${compact ? "p-2.5" : "p-4"}`}
    >
      <div
        className={`grid gap-2 ${compact ? "" : "sm:grid-cols-[minmax(0,1fr)_auto]"} sm:items-start`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2
              className={`${compact ? "text-[14px]" : "text-[16px]"} font-semibold text-[#1d1d1f]`}
            >
              {project.projectName}
            </h2>
            {project.isPm && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                PM
              </span>
            )}
            {project.isPl && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                PL
              </span>
            )}
            {compact && (
              <span className="text-[11px] text-[#86868b]">
                {project.projectId}
              </span>
            )}
            {compact && (
              <span className="text-[11px] text-[#86868b]">
                請求 {formatBillingStatus(project.billingStatus)}
              </span>
            )}
          </div>
          {!compact && (
            <p className="mt-1 text-xs text-[#86868b]">
              {project.projectId} / 請求状態{" "}
              {formatBillingStatus(project.billingStatus)}
            </p>
          )}
          {!linksInNewTab && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                href={cockpitHref}
                {...linkTargetProps}
                className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
              >
                今シーズンのMSを見る
                <ArrowRight className="size-3" />
              </Link>
              {viewerIsAdmin && (
                <Link
                  href={msOverviewHref}
                  {...linkTargetProps}
                  className="inline-flex items-center gap-1 rounded-md border border-[#d1d1d6] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#3c3c43] hover:bg-[#f5f5f7]"
                >
                  MSの設計を確認
                  <ArrowRight className="size-3" />
                </Link>
              )}
              <Hint id="monthly-agreement.ms-link" />
            </div>
          )}
        </div>
        {!compact && (
          <div
            className={`rounded-md border px-3 py-2 text-right ${hasStock ? "border-amber-200 bg-amber-50" : "border-transparent bg-[#f5f5f7]"}`}
          >
            <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-[#86868b]">
              <CircleDollarSign className="size-3.5" />
              もらえる予定額 <Hint id="monthly-agreement.expected-reward" />
            </div>
            <p className="mt-0.5 text-[20px] font-semibold tabular-nums text-[#1d1d1f]">
              {formatYen(headlineValue)}
            </p>
            {hasScheduledPayout && project.paymentYm ? (
              <p className="mt-1 text-[10px] tabular-nums text-[#86868b]">
                この月の仕事の支払い予定 {formatYm(project.paymentYm)}{" "}
                {formatYen(scheduledPayoutYen)}
              </p>
            ) : null}
            {hasPayout && !currentCyclePaysThisMonth ? (
              <p className="mt-1 text-[10px] tabular-nums text-[#86868b]">
                今月支払う分（別の月の仕事） {formatYen(currentMonthPayoutYen)}
              </p>
            ) : null}
            {hasStock && (
              <div className="mt-2 border-t border-amber-200 pt-2 text-left">
                <p className="text-[10px] font-semibold text-amber-800">
                  月末未払い残 <Hint id="monthly-agreement.stock" />
                </p>
                <p className="mt-0.5 text-right text-[16px] font-semibold tabular-nums text-amber-800">
                  {formatYen(stockYen)}
                </p>
                {showStockBreakdown && (
                  <dl className="mt-1.5 space-y-0.5 text-[10px] text-[#86868b]">
                    {carryInYen > 0 && (
                      <div className="flex items-center justify-between gap-3">
                        <dt>前月残</dt>
                        <dd className="tabular-nums">
                          {formatYen(carryInYen)}
                        </dd>
                      </div>
                    )}
                    {currentDueYen != null && (
                      <div className="flex items-center justify-between gap-3">
                        <dt>当月発生</dt>
                        <dd className="tabular-nums">
                          {formatYen(currentDueYen)}
                        </dd>
                      </div>
                    )}
                    {hasPayout && (
                      <div className="flex items-center justify-between gap-3">
                        <dt>今月支払</dt>
                        <dd className="tabular-nums">
                          -{formatYen(currentMonthPayoutYen)}
                        </dd>
                      </div>
                    )}
                    {!currentCyclePaysThisMonth &&
                      hasScheduledPayout &&
                      project.paymentYm && (
                        <div className="flex items-center justify-between gap-3">
                          <dt>{formatYm(project.paymentYm)}支払予定</dt>
                          <dd className="tabular-nums">
                            {formatYen(scheduledPayoutYen)}
                          </dd>
                        </div>
                      )}
                  </dl>
                )}
              </div>
            )}
            {hasStock && project.grossDueYen != null && (
              <p className="mt-1 text-[10px] tabular-nums text-[#86868b]">
                支払対象（前月残を含む） {formatYen(project.grossDueYen)}
              </p>
            )}
          </div>
        )}
      </div>

      {!compact && (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <ConceptPill
            label="予定額"
            value={formatYen(headlineValue)}
            hintId="monthly-agreement.expected-reward"
            tone="sky"
          />
          <ConceptPill
            label="支払いの予定"
            value={
              hasScheduledPayout
                ? `${project.paymentYm ? formatYm(project.paymentYm) : ""} ${formatYen(scheduledPayoutYen)}`
                : hasPayout
                  ? `今月支払う分 ${formatYen(currentMonthPayoutYen)}`
                  : "支払い予定なし"
            }
            hintId="monthly-agreement.payout"
            tone="emerald"
          />
          <ConceptPill
            label="支払ったあとに残る分"
            value={formatYen(stockYen)}
            hintId="monthly-agreement.stock"
            tone={hasStock ? "amber" : "plain"}
          />
        </div>
      )}

      {(project.reviewReasons.length > 0 || project.conditions.length > 0) && (
        <div
          className={`${compact ? "mt-2 px-2.5 py-1.5 text-[11px]" : "mt-3 px-3 py-2 text-[12px]"} rounded-md border border-amber-200 bg-amber-50 text-amber-900`}
        >
          {project.reviewReasons.length > 0 && (
            <p className="font-semibold">
              確認が必要: {project.reviewReasons.join(" / ")}
            </p>
          )}
          {project.conditions.length > 0 && (
            <p
              className={project.reviewReasons.length > 0 ? "mt-1" : undefined}
            >
              条件: {project.conditions.join(" / ")}
            </p>
          )}
        </div>
      )}

      {(hasMilestones || hasPayoutSchedule) && (
        <div className={compact ? "mt-2.5 grid max-w-full gap-2" : ""}>
          {compact && hasPayoutSchedule && (
            <details className="order-3 w-full overflow-hidden rounded-md border border-[#e5e5e7] bg-[#fbfbfd]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-1.5">
                <div>
                  <span className="text-[10px] font-semibold text-[#86868b]">
                    参考情報
                  </span>
                  <h3 className="text-[12px] font-semibold text-[#3c3c43]">
                    支払い予定・未払残
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-[#007aff]">
                  開く
                </span>
              </summary>
              <div className="border-t border-[#e5e5e7] bg-white p-2">
                <PayoutScheduleTable
                  rows={payoutSchedule}
                  compact={compact}
                  embedded
                />
              </div>
            </details>
          )}
          {hasMilestones && (
            <div
              className={`${compact ? "order-1 w-full max-w-full" : "mt-4"} overflow-hidden rounded-md border border-[#e5e5e7]`}
            >
              <div
                className={`flex flex-wrap items-center justify-between gap-2 bg-[#f5f5f7] ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}
              >
                <div className="min-w-0">
                  <h3 className="text-[12px] font-semibold text-[#3c3c43]">
                    {compact ? "担当内容・到達目標の詳細" : "今シーズンのMS"}{" "}
                    <Hint id="monthly-agreement.ms-pt" />
                  </h3>
                  <p
                    className={`${compact ? "mt-0.5" : "mt-1"} text-[11px] leading-relaxed text-[#6e6e73]`}
                  >
                    {compact
                      ? "上の必須確認に対する、担当内容と今月の到達目標の詳しい一覧です。pt・担当割合は予定額の根拠です。"
                      : "予定額は、ここに出ているMSのpt・今月進める分・担当割合から出しています。"}
                  </p>
                </div>
                {!linksInNewTab && (
                  <Link
                    href={cockpitHref}
                    {...linkTargetProps}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007aff]"
                  >
                    プロジェクト画面でMSを見る
                    <ArrowRight className="size-3" />
                  </Link>
                )}
              </div>
              <div className="divide-y divide-[#e5e5e7] bg-white md:hidden">
                {project.milestones.map((ms) => {
                  const shareLabel =
                    ms.plannedShare == null
                      ? "未設定"
                      : `${Math.round(ms.plannedShare * 100)}%`;
                  const progressLabel =
                    ms.progressPct == null
                      ? "まだ計算なし"
                      : `${ms.progressPct.toFixed(1)}%`;
                  return (
                    <div
                      key={ms.milestoneId}
                      className={`${compact ? "px-2.5 py-2" : "px-3 py-3"} text-[12px]`}
                    >
                      <p className="font-semibold leading-relaxed text-[#1d1d1f]">
                        {ms.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#86868b]">
                        {ms.taskDescription || `${formatPt(ms.points)}のMS`}
                      </p>
                      <dl
                        className={`${compact ? "mt-2 gap-1.5" : "mt-3 gap-2"} grid grid-cols-2`}
                      >
                        {!compact && (
                          <div className="rounded-md bg-[#f5f5f7] px-2 py-1.5">
                            <dt className="text-[10px] font-semibold text-[#86868b]">
                              担当割合
                            </dt>
                            <dd className="mt-0.5 font-semibold tabular-nums text-[#3c3c43]">
                              {shareLabel}
                            </dd>
                          </div>
                        )}
                        <div className="rounded-md bg-[#f5f5f7] px-2 py-1.5">
                          <dt className="text-[10px] font-semibold text-[#86868b]">
                            進み具合
                          </dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-[#3c3c43]">
                            {progressLabel}
                            {ms.monthlyProgressPct != null &&
                              ms.monthlyProgressPct > 0 && (
                                <span className="block text-[10px] font-normal text-[#86868b]">
                                  今月 +{ms.monthlyProgressPct.toFixed(1)}pt
                                </span>
                              )}
                          </dd>
                        </div>
                        {!compact && (
                          <div className="rounded-md bg-[#f5f5f7] px-2 py-1.5">
                            <dt className="text-[10px] font-semibold text-[#86868b]">
                              今月のpt
                            </dt>
                            <dd className="mt-0.5 font-semibold tabular-nums text-[#3c3c43]">
                              {formatPt(ms.earnedPt)}
                            </dd>
                          </div>
                        )}
                        {!compact && (
                          <div className="rounded-md bg-sky-50 px-2 py-1.5">
                            <dt className="text-[10px] font-semibold text-sky-800">
                              予定額
                            </dt>
                            <dd className="mt-0.5 font-semibold tabular-nums text-sky-950">
                              {formatYen(ms.expectedRewardYen)}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <div
                  className={`${msTableWidth} ${compact ? "grid gap-x-2 xl:grid-cols-[max-content_max-content]" : ""}`}
                >
                  {compactMilestoneGroups.map((group, groupIndex) => (
                    <div
                      key={groupIndex}
                      className={compact ? "w-[500px] max-w-full" : undefined}
                    >
                      <div
                        className={`${msGridCols} ${compact ? "gap-1.5 px-2 py-1" : "px-3 py-2"} grid bg-white text-[11px] font-semibold text-[#6e6e73]`}
                      >
                        <span>遂行内容</span>
                        {!compact && (
                          <span className="text-right">担当割合</span>
                        )}
                        <span className="text-right">進み具合/今月</span>
                        {!compact && (
                          <span className="text-right">今月のpt</span>
                        )}
                        {!compact && <span className="text-right">予定額</span>}
                      </div>
                      <div className="divide-y divide-[#e5e5e7]">
                        {group.map((ms) => {
                          const shareLabel =
                            ms.plannedShare == null
                              ? "未設定"
                              : `${Math.round(ms.plannedShare * 100)}%`;
                          return (
                            <div
                              key={ms.milestoneId}
                              className={`${msGridCols} ${compact ? "gap-1.5 px-2 py-1.5" : "gap-2 px-3 py-2"} grid text-[12px]`}
                            >
                              <div className="min-w-0">
                                <p
                                  className={`${compact ? "truncate" : ""} font-semibold text-[#1d1d1f]`}
                                >
                                  {ms.title}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] text-[#86868b]">
                                  {ms.taskDescription ||
                                    `${formatPt(ms.points)}のMS`}
                                </p>
                              </div>
                              {!compact && (
                                <span className="text-right tabular-nums text-[#3c3c43]">
                                  {shareLabel}
                                </span>
                              )}
                              <span className="text-right tabular-nums text-[#3c3c43]">
                                {ms.progressPct == null
                                  ? "まだ計算なし"
                                  : `${ms.progressPct.toFixed(1)}%`}
                                {ms.monthlyProgressPct != null &&
                                  ms.monthlyProgressPct > 0 && (
                                    <span className="block text-[10px] text-[#86868b]">
                                      +{ms.monthlyProgressPct.toFixed(1)}pt
                                    </span>
                                  )}
                              </span>
                              {!compact && (
                                <span className="text-right tabular-nums text-[#3c3c43]">
                                  {formatPt(ms.earnedPt)}
                                </span>
                              )}
                              {!compact && (
                                <span className="text-right tabular-nums font-semibold text-[#3c3c43]">
                                  {formatYen(ms.expectedRewardYen)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {compact && hasMilestones && (
            <details className="order-2 w-full overflow-hidden rounded-md border border-[#e5e5e7] bg-[#fbfbfd]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-1.5">
                <div>
                  <span className="text-[10px] font-semibold text-[#86868b]">
                    参考情報
                  </span>
                  <h3 className="text-[12px] font-semibold text-[#3c3c43]">
                    予定額の根拠
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-[#007aff]">
                  開く
                </span>
              </summary>
              <div className="divide-y divide-[#e5e5e7] border-t border-[#e5e5e7] bg-white">
                {project.milestones.map((ms) => (
                  <div
                    key={ms.milestoneId}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-1.5 text-[11px]"
                  >
                    <span className="min-w-0 truncate font-semibold text-[#3c3c43]">
                      {ms.title}
                    </span>
                    <span className="whitespace-nowrap tabular-nums text-[#6e6e73]">
                      担当割合{" "}
                      {ms.plannedShare == null
                        ? "未設定"
                        : `${Math.round(ms.plannedShare * 100)}%`}{" "}
                      / 今月のpt {formatPt(ms.earnedPt)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {!compact && hasPayoutSchedule && (
            <PayoutScheduleTable
              rows={payoutSchedule}
              compact={compact}
              embedded={false}
            />
          )}
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
      <p className="mt-1 truncate text-[13px] font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function PayoutScheduleTable({
  rows,
  compact = false,
  embedded = false,
}: {
  rows: MonthlyWorkAgreementProject["payoutSchedule"];
  compact?: boolean;
  embedded?: boolean;
}) {
  return (
    <div
      className={`${embedded ? "" : compact ? "mt-2.5" : "mt-4"} ${compact ? "w-full max-w-full" : ""} overflow-hidden rounded-md border border-[#e5e5e7]`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 bg-[#f5f5f7] ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}
      >
        <h3 className="text-[12px] font-semibold text-[#3c3c43]">
          未払いがどう残るか <Hint id="monthly-agreement.stock-flow" />
        </h3>
        <span
          className={`${compact ? "hidden lg:inline" : ""} text-[10px] text-[#86868b]`}
        >
          前月残 + 当月発生 - 支払 = 未払残
        </span>
      </div>
      <PayoutScheduleMatrix rows={rows} compact={compact} />
    </div>
  );
}

function payoutSourceLabel(
  row: MonthlyWorkAgreementProject["payoutSchedule"][number],
) {
  if (row.amountSource === "actual_paid") return "支払い済み";
  if (row.amountSource === "unverified_paid") return "確認中";
  if (row.amountSource === "payout_snapshot") return "保存済み";
  if (row.amountSource === "protected_reward_cache") return "過去の保存額";
  return "予定";
}

function PayoutSourceBadge({
  row,
  inline = false,
}: {
  row: MonthlyWorkAgreementProject["payoutSchedule"][number];
  inline?: boolean;
}) {
  const label = payoutSourceLabel(row);
  const cls = row.isActualPaid
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : row.amountSource === "unverified_paid"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-[#d1d1d6] bg-white text-[#6e6e73]";
  const badge = (
    <span
      className={`whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
  if (inline) return badge;
  return <div className="mt-1">{badge}</div>;
}

type PayoutScheduleEntry =
  MonthlyWorkAgreementProject["payoutSchedule"][number];

function PayoutScheduleMatrix({
  rows,
  compact = false,
}: {
  rows: MonthlyWorkAgreementProject["payoutSchedule"];
  compact?: boolean;
}) {
  const labelColumnWidth = compact ? 92 : 124;
  const monthColumnWidth = compact ? 124 : 156;
  const minTableWidth = labelColumnWidth + rows.length * monthColumnWidth;
  const labelCellClass = `${compact ? "px-2 py-2" : "px-3 py-2.5"} sticky left-0 z-10 border-b border-r border-[#e5e5e7] bg-[#fbfbfd] text-left`;
  const valueCellClass = `${compact ? "px-2 py-2" : "px-3 py-2.5"} border-b border-r border-[#e5e5e7] text-right align-top tabular-nums`;

  return (
    <div className="overflow-x-auto bg-white">
      <table
        className="w-full border-collapse text-[11px]"
        style={{ minWidth: `${minTableWidth}px` }}
      >
        <colgroup>
          <col style={{ width: labelColumnWidth }} />
          {rows.map((row) => (
            <col
              key={`${row.sourceYm}:${row.paymentYm}`}
              style={{ width: monthColumnWidth }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              className={`${labelCellClass} top-0 bg-[#f5f5f7] font-semibold text-[#6e6e73]`}
            >
              項目
            </th>
            {rows.map((row) => (
              <th
                key={`${row.sourceYm}:${row.paymentYm}`}
                className={`${compact ? "px-2 py-2" : "px-3 py-2.5"} border-b border-r border-[#e5e5e7] text-right align-top ${row.isCurrentYm ? "bg-amber-50" : "bg-[#f5f5f7]"}`}
              >
                <div className="flex items-start justify-between gap-2 text-left">
                  {row.isCurrentYm ? (
                    <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                      今回
                    </span>
                  ) : (
                    <span />
                  )}
                  <div className="min-w-0 text-right">
                    <div className="font-semibold text-[#1d1d1f]">
                      {formatYm(row.sourceYm)}
                    </div>
                    <div className="mt-0.5 text-[10px] font-normal text-[#86868b]">
                      {formatYm(row.paymentYm)}支払
                    </div>
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <PayoutMatrixRow
            label="前月残"
            description="前から残る分"
            rows={rows}
            valueCellClass={valueCellClass}
            labelCellClass={labelCellClass}
            render={(row) => (
              <PayoutMatrixAmount
                value={row.carryInYen}
                tone={row.carryInYen > 0 ? "plain" : "muted"}
              />
            )}
          />
          <PayoutMatrixRow
            label="当月発生"
            description="今月の仕事分"
            rows={rows}
            valueCellClass={valueCellClass}
            labelCellClass={labelCellClass}
            render={(row) => (
              <PayoutMatrixAmount value={row.basePayYen} tone="sky" />
            )}
          />
          <PayoutMatrixRow
            label="支払対象"
            description="残 + 発生"
            rows={rows}
            valueCellClass={valueCellClass}
            labelCellClass={labelCellClass}
            render={(row) => (
              <PayoutMatrixAmount value={row.grossDueYen} tone="plain" />
            )}
          />
          <PayoutMatrixRow
            label="支払"
            description="税抜 / 税込"
            rows={rows}
            valueCellClass={valueCellClass}
            labelCellClass={labelCellClass}
            render={(row) => (
              <div className="space-y-1">
                <PayoutMatrixAmount
                  value={row.totalPayYen}
                  tone={row.totalPayYen > 0 ? "emerald" : "muted"}
                  prefix="税抜 "
                />
                <div className="text-[10px] leading-tight text-[#86868b]">
                  税込 {formatYen(row.totalPayTaxIncludedYen)}
                </div>
                <PayoutSourceBadge row={row} inline />
              </div>
            )}
          />
          <PayoutMatrixRow
            label="月末残"
            description="支払後に残る分"
            rows={rows}
            valueCellClass={valueCellClass}
            labelCellClass={labelCellClass}
            render={(row) => (
              <PayoutMatrixAmount
                value={row.stockYen}
                tone={row.stockYen > 0 ? "amber" : "muted"}
              />
            )}
          />
        </tbody>
      </table>
    </div>
  );
}

function PayoutMatrixRow({
  label,
  description,
  rows,
  valueCellClass,
  labelCellClass,
  render,
}: {
  label: string;
  description: string;
  rows: PayoutScheduleEntry[];
  valueCellClass: string;
  labelCellClass: string;
  render: (row: PayoutScheduleEntry) => ReactNode;
}) {
  return (
    <tr>
      <th className={labelCellClass}>
        <div className="font-semibold text-[#3c3c43]">{label}</div>
        <div className="mt-0.5 text-[10px] font-normal text-[#86868b]">
          {description}
        </div>
      </th>
      {rows.map((row) => (
        <td
          key={`${label}:${row.sourceYm}:${row.paymentYm}`}
          className={`${valueCellClass} ${row.isCurrentYm ? "bg-amber-50/55" : "bg-white"}`}
        >
          {render(row)}
        </td>
      ))}
    </tr>
  );
}

function PayoutMatrixAmount({
  value,
  tone,
  prefix = "",
}: {
  value: number;
  tone: "plain" | "muted" | "sky" | "emerald" | "amber";
  prefix?: string;
}) {
  const toneClass =
    tone === "sky"
      ? "text-sky-800"
      : tone === "emerald"
        ? "text-emerald-700"
        : tone === "amber"
          ? "text-amber-800"
          : tone === "muted"
            ? "text-[#86868b]"
            : "text-[#1d1d1f]";
  return (
    <div className={`whitespace-nowrap font-semibold ${toneClass}`}>
      {prefix}
      {formatYen(value)}
    </div>
  );
}
