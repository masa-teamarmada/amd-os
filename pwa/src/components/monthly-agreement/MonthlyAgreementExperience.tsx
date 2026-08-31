"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  Loader2,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { Hint } from "@/components/ui/Hint";
import type {
  ExpectedRewardChangeExplanation,
  MonthlyAgreementAmountChangeReason,
  MonthlyAgreementSnapshotDiff,
  MonthlyAgreementStatus,
  MonthlyWorkAgreementBundle,
  MonthlyWorkAgreementMilestone,
  MonthlyWorkAgreementProject,
  MonthlyWorkAgreementProjectAgreement,
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
  if (status === "needs_reagreement") return "条件更新あり";
  if (status === "not_required") return "対象外";
  return "未合意";
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
    const agreedAt = bundle.latestAgreement?.agreedAt
      ? new Date(bundle.latestAgreement.agreedAt).toLocaleString("ja-JP")
      : "記録済み";
    return `この内容で合意済みです。確認した日時: ${agreedAt}`;
  }
  if (bundle.status === "needs_reagreement") {
    return "前回合意後に合意内容が更新されたので最新内容を再確認してください。";
  }
  if (bundle.status === "not_required") {
    return bundle.exclusionReason || "この月は対象外です。";
  }
  return "担当内容と予定額の確認・合意がまだ完了していません。";
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
  /**
   * 1つのPJだけを表示する。管理側が `/admin/monthly-work-agreements` から
   * 「そのメンバーがそのPJで実際に見ている画面」を確認するために使う。
   */
  focusProjectId?: string;
  initialBundle?: MonthlyWorkAgreementBundle | null;
  onResolved?: () => void;
  onDismiss?: () => void;
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
  focusProjectId = "",
  initialBundle = null,
  onResolved,
  onDismiss,
}: MonthlyAgreementExperienceProps) {
  const ym = initialBundle?.ym || initialYm || currentYmJst();
  const memberId = initialBundle?.member.memberId || initialMemberId;
  const [bundle, setBundle] = useState<MonthlyWorkAgreementBundle | null>(
    initialBundle,
  );
  const [loading, setLoading] = useState(!initialBundle);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestBody, setRequestBody] = useState("");
  const [requestProjectId, setRequestProjectId] = useState("");
  const [requestType, setRequestType] = useState("scope_or_goal");
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const skipInitialLoadRef = useRef(Boolean(initialBundle));
  const isModal = mode === "modal";

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
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
      if (!silent) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [memberId, ym]);

  useEffect(() => {
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    void load();
  }, [load]);

  // 管理側が理由を入力したあと、メンバーがモーダルを開いたままでも確認待ちを解消できるようにする。
  // 通常の閲覧中は余計な通信をせず、未入力の理由がある間だけ静かに再取得する。
  const missingReasonKey = bundle?.missingAmountChangeReasonProjectIds.join("|") ?? "";
  useEffect(() => {
    if (!missingReasonKey) return;
    const timer = window.setInterval(() => void load({ silent: true }), 15_000);
    return () => window.clearInterval(timer);
  }, [load, missingReasonKey]);

  // 合意はPJごとに保存する。押されたPJの分だけを送り、他のPJの合意状態は動かさない
  const handleAgree = async (projectId: string | null) => {
    if (!bundle || savingProjectId) return;
    setSavingProjectId(projectId ?? "__all__");
    setError(null);
    try {
      const res = await fetch("/api/monthly-work-agreement/agree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ym: bundle.ym,
          memberId: bundle.member.memberId,
          projectId,
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
      setSavingProjectId(null);
    }
  };

  const handleRevisionRequest = async () => {
    if (!bundle || requestSaving || !bundle.canRequestRevision) return;
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
            onClick={() => void load()}
            className="ml-3 rounded-md border border-red-200 px-3 py-1 text-xs font-semibold"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  // 管理側がPJを指定して開いたときは、そのPJのブロックだけを出す。
  // メンバーが実際に見る画面と同じ表示のまま、確認したいPJへ絞る
  const focusedProject = focusProjectId
    ? bundle.snapshot.projects.find((project) => project.projectId === focusProjectId) ?? null
    : null;
  const visibleProjects = focusedProject ? [focusedProject] : bundle.snapshot.projects;
  const focusMissing = Boolean(focusProjectId) && focusedProject == null;

  const totalStockYen = bundle.snapshot.totals.stockYen ?? 0;
  const paidActualYen = bundle.snapshot.totals.paidActualYen ?? 0;
  const unverifiedPaidYen = bundle.snapshot.totals.unverifiedPaidYen ?? 0;
  const futurePayoutYen = bundle.snapshot.totals.futurePayoutYen ?? 0;
  const metricCount =
    4 + (unverifiedPaidYen > 0 ? 1 : 0) + (totalStockYen > 0 ? 1 : 0);
  const summaryCols = metricCount >= 5 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  const contentWidth = isModal ? "max-w-4xl" : "max-w-5xl";

  return (
    <div
      className={`${isModal ? "min-h-0 overflow-y-auto" : "min-h-screen pb-12"} bg-[#f5f5f7]`}
    >
      <div
        className={`${isModal ? "sticky top-0 z-10 px-3 py-3 pr-14" : "px-4 py-5"} border-b border-[#e5e5e7] bg-white`}
      >
        {isModal && onDismiss && (
          <button
            type="button"
            data-testid="monthly-agreement-modal-close"
            onClick={onDismiss}
            aria-label="閉じる"
            title="閉じる（合意はまだ保存されません）"
            className="absolute right-2 top-2 inline-flex size-10 items-center justify-center rounded-md border border-[#d1d1d6] bg-white text-[#3c3c43] transition-colors hover:bg-[#f5f5f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] sm:size-8"
          >
            <X className="size-4" />
          </button>
        )}
        <div
          className={`mx-auto flex ${contentWidth} flex-col gap-3 sm:flex-row sm:items-end sm:justify-between`}
        >
          <div className="min-w-0">
            <p
              className={`${isModal ? "text-[10px]" : "text-[11px]"} font-semibold tracking-[0.16em] text-[#86868b]`}
            >
              月初合意
            </p>
            <h1
              className={`${isModal ? "text-[16px] sm:text-[18px]" : "text-[22px]"} mt-0.5 font-semibold leading-tight text-[#1d1d1f]`}
            >
              {formatYm(bundle.ym)}の担当内容と予定額
            </h1>
            <p className={`${isModal ? "mt-0.5 text-[11px]" : "mt-1 text-[13px]"} text-[#6e6e73]`}>
              {bundle.member.codeName}
            </p>
          </div>
          {isModal ? (
            <p className="hidden max-w-[220px] text-[11px] leading-4 text-[#6e6e73] sm:block">
              右上の × か背景のクリックで閉じます（合意は保存されません）。
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
          data-testid="monthly-agreement-status"
          className={`w-full rounded-lg border ${isModal ? "p-2.5 sm:p-3" : "p-4"} ${statusClass(bundle.status)}`}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            {bundle.status === "agreed" ? (
              <CheckCircle2 className="mt-0.5 size-4" />
            ) : (
              <FileCheck2 className="mt-0.5 size-4" />
            )}
            <div className="min-w-0">
              <p className={`${isModal ? "text-[12px]" : "text-[14px]"} font-semibold`}>
                合意状態：{statusLabel(bundle.status)}
              </p>
              <p className={`${isModal ? "mt-0.5 text-[11px] leading-4" : "mt-1 text-[13px] leading-[20px]"}`}>
                {agreementStatusMessage(bundle)}
              </p>
            </div>
          </div>
          {!bundle.tableReady && (
            <p
              className={`${isModal ? "mt-2 px-2 py-1 text-[11px]" : "mt-3 px-3 py-2 text-xs"} rounded-md border border-red-200 bg-white/70 text-red-700`}
            >
              保存に必要な準備がまだ終わっていません。準備が終わると合意できます。
            </p>
          )}
        </section>

        {focusProjectId && (
          <section
            data-testid="monthly-agreement-project-focus"
            className="w-full rounded-lg border border-[#d1d1d6] bg-white px-4 py-3"
          >
            <p className="text-[13px] leading-[20px] text-[#3c3c43]">
              {focusMissing
                ? `${bundle.member.codeName} さんの ${formatYm(bundle.ym)} に、指定されたPJはありません。`
                : `${bundle.member.codeName} さんが ${focusedProject?.projectName} で見ている画面です。`}
            </p>
            <Link
              href={`/monthly-agreement?ym=${encodeURIComponent(bundle.ym)}&memberId=${encodeURIComponent(bundle.member.memberId)}`}
              className="mt-1 inline-block text-[13px] font-semibold text-[#007aff]"
            >
              この人の全PJを見る
            </Link>
          </section>
        )}

        <RequiredChecksSection
          compact={isModal}
          ym={bundle.ym}
          projects={visibleProjects}
          agreements={
            focusedProject
              ? bundle.projectAgreements.filter((item) => item.projectId === focusedProject.projectId)
              : bundle.projectAgreements
          }
          totalExpectedRewardYen={
            focusedProject ? focusedProject.expectedRewardYen : bundle.snapshot.totals.expectedRewardYen
          }
          payoutExcluded={Boolean(bundle.snapshot.member.excludeFromPayoutNotice)}
          amountChangeReasons={bundle.amountChangeReasons}
          requiredProjectIds={bundle.amountChangeReasonRequiredProjectIds}
          missingProjectIds={bundle.missingAmountChangeReasonProjectIds}
          explanations={bundle.expectedRewardChangeExplanations}
          canRequestRevision={bundle.canRequestRevision}
          projectScoped={bundle.projectScopedAgreement}
          savingProjectId={savingProjectId}
          onAgree={(projectId) => void handleAgree(projectId)}
          onRequestRevision={(projectId, type) => {
            setRequestProjectId(projectId);
            setRequestType(type);
            setRequestMessage(null);
            setRevisionOpen(true);
          }}
        />

        <section className={`w-full rounded-lg border border-[#e5e5e7] bg-white ${isModal ? "p-3" : "p-4"}`}>
          {/* PJ単位化 (202609 稼働分〜) より前の月と、参加PJが無い月は、従来どおり1回の合意 */}
          {(!bundle.projectScopedAgreement || bundle.snapshot.projects.length === 0) &&
            bundle.status !== "not_required" && (
            <div className="mb-3">
              <p className="text-[13px] leading-[20px] text-[#3c3c43]">
                {bundle.snapshot.projects.length === 0
                  ? `${formatYm(bundle.ym)}に参加中のプロジェクトはありません。`
                  : "上のプロジェクトごとの内容を確認したうえで、この月の内容に合意してください。合意が終わるまで、この月の支払いには進めません。"}
              </p>
              {bundle.missingAmountChangeReasonProjectIds.length > 0 && (
                <p
                  data-testid="monthly-agreement-missing-change-reason"
                  className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-[20px] text-amber-900"
                >
                  予定額が変更された理由を管理側で確認中です。理由が表示されるまで、この内容には合意できません。
                </p>
              )}
              <button
                type="button"
                data-testid="monthly-agreement-agree-button"
                onClick={() => void handleAgree(null)}
                disabled={
                  savingProjectId != null ||
                  bundle.status === "agreed" ||
                  !bundle.tableReady ||
                  !bundle.canAgree
                }
                title={
                  !bundle.canAgree
                    ? bundle.exclusionReason || "本人だけが合意できます"
                    : "担当内容と予定額を確認して合意"
                }
                className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#007aff] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#006edb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-auto sm:px-4 sm:text-[14px]"
              >
                {savingProjectId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileCheck2 className="size-4" />
                )}
                {bundle.status === "agreed"
                  ? "合意済み"
                  : bundle.snapshot.projects.length === 0
                    ? "確認した"
                    : "確認して合意"}
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
            <button
              type="button"
              data-testid="monthly-agreement-revision-button"
              aria-expanded={revisionOpen}
              aria-controls="monthly-agreement-revision-panel"
              onClick={() => {
                setRequestMessage(null);
                setRevisionOpen((open) => !open);
              }}
              disabled={!bundle.canRequestRevision}
              className="inline-flex h-11 w-full items-center justify-center gap-1 rounded-md border border-[#d1d1d6] bg-transparent px-3 text-[13px] font-semibold text-[#3c3c43] opacity-80 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-auto sm:px-3 sm:text-[12px]"
              title={
                !bundle.canRequestRevision
                  ? bundle.exclusionReason || "本人だけが修正要望を送れます"
                  : "担当内容、または予定額の修正要望を送る"
              }
            >
              <Send className="size-3" />
              内容が違う場合は修正要望
            </button>
          </div>
          {revisionOpen && (
            <section
              data-testid="monthly-agreement-revision-panel"
              id="monthly-agreement-revision-panel"
              aria-labelledby="monthly-agreement-revision-heading"
              className={`${isModal ? "mt-2 pt-2" : "mt-4 pt-3"} border-t border-[#e5e5e7]`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    id="monthly-agreement-revision-heading"
                    className={`${isModal ? "text-[12px]" : "text-sm"} font-semibold text-[#1d1d1f]`}
                  >
                    修正要望
                  </h2>
                  <p
                    className={`${isModal ? "mt-0.5 text-[10px]" : "mt-1 text-xs"} leading-relaxed text-[#6e6e73]`}
                  >
                    担当内容、予定額に違いがあるときだけ送ってください。
                    <Hint id="monthly-agreement.revision-request" />
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRevisionOpen(false)}
                  className="text-[11px] font-semibold text-[#6e6e73] opacity-75 hover:opacity-100"
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
                  disabled={!bundle.canRequestRevision}
                  className={`${isModal ? "h-8 py-1 text-xs" : "py-2 text-sm"} min-w-0 rounded-md border border-[#d1d1d6] bg-white px-2 text-[#1d1d1f]`}
                >
                  <option value="scope_or_goal">担当内容</option>
                  <option value="reward">予定額</option>
                  <option value="other">その他</option>
                </select>
                <select
                  value={requestProjectId}
                  onChange={(event) => setRequestProjectId(event.target.value)}
                  disabled={!bundle.canRequestRevision}
                  className={`${isModal ? "h-8 py-1 text-xs" : "py-2 text-sm"} min-w-0 rounded-md border border-[#d1d1d6] bg-white px-2 text-[#1d1d1f]`}
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
                  disabled={!bundle.canRequestRevision}
                  rows={isModal ? 2 : 3}
                  className={`${isModal ? "sm:col-span-2 text-xs" : "min-h-[84px] text-sm"} min-h-12 rounded-md border border-[#d1d1d6] bg-white px-3 py-2 text-[#1d1d1f] outline-none focus:border-[#007aff]`}
                  placeholder="例: この目標ではなく、登記準備を優先したい"
                />
              </div>
              <div
                className={`${isModal ? "mt-2" : "mt-3"} flex flex-wrap items-center justify-between gap-2`}
              >
                <p
                  className={`${isModal ? "text-[10px]" : "text-[11px]"} text-[#86868b]`}
                >
                  送った時点の記録IDも一緒に残ります。
                </p>
                <button
                  type="button"
                  onClick={handleRevisionRequest}
                  disabled={
                    requestSaving ||
                    !bundle.canRequestRevision ||
                    requestBody.trim().length < 4
                  }
                  className={`${isModal ? "h-8 px-3 text-xs" : "px-3 py-2 text-xs"} inline-flex items-center justify-center gap-1.5 rounded-md border border-[#d1d1d6] bg-white font-semibold text-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-50`}
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
                <div className="mt-2 divide-y divide-[#e5e5e7] border-t border-[#e5e5e7] text-[11px]">
                  {bundle.revisionRequests.slice(0, 3).map((request) => (
                    <div key={request.id} className="py-1.5">
                      <span className="font-semibold text-[#1d1d1f]">
                        {request.status === "open" ? "対応中" : request.status}
                      </span>
                      <span className="ml-2 text-[#6e6e73]">
                        {request.projectId || "全体"}
                      </span>
                      <p className="mt-0.5 line-clamp-2 text-[#3c3c43]">
                        {request.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </section>

        <details className="group w-full overflow-hidden rounded-lg border border-[#e5e5e7] bg-white">
          <summary className="group flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2.5">
            <h2 className="text-[13px] font-semibold text-[#1d1d1f]">
              参考情報
            </h2>
            <span className="text-[11px] font-semibold text-[#007aff] group-open:hidden">
              開く
            </span>
            <span className="hidden text-[11px] font-semibold text-[#007aff] group-open:inline">
              閉じる
            </span>
          </summary>
          <div className="flex flex-col gap-3 border-t border-[#e5e5e7] p-3">
            <p className="text-[11px] text-[#6e6e73]">
              記録ID {bundle.currentHash.slice(0, 10)}
            </p>

            <div className={`grid gap-3 sm:grid-cols-2 ${summaryCols}`}>
              <MetricCard
                label="対象プロジェクト"
                value={`${bundle.snapshot.totals.projectCount}`}
                hintId="monthly-agreement.project-count"
              />
              <MetricCard
                label="次にもらえる金額"
                value={formatYen(bundle.snapshot.totals.expectedRewardYen)}
                hintId="monthly-agreement.expected-reward"
                description={
                  bundle.snapshot.totals.carryInYen > 0
                    ? `今月やる仕事の分に、これまで支払いを待ってもらっている分の返済を足した金額。今月やる仕事の分は ${formatYen(bundle.snapshot.totals.currentMonthAccrualYen)}`
                    : "今月やる仕事に対して支払う金額"
                }
              />
              <MetricCard
                label="支払い済み"
                value={formatYen(paidActualYen)}
                hintId="monthly-agreement.payout"
              />
              {unverifiedPaidYen > 0 && (
                <MetricCard
                  label="支払い確認中"
                  value={formatYen(unverifiedPaidYen)}
                  emphasis
                  hintId="monthly-agreement.payout"
                />
              )}
              <MetricCard
                label="これから支払う予定"
                value={formatYen(futurePayoutYen)}
                hintId="monthly-agreement.payout"
              />
              {totalStockYen > 0 && (
                <MetricCard
                  label="まだ支払われていない残り"
                  value={formatYen(totalStockYen)}
                  emphasis
                  hintId="monthly-agreement.stock"
                  description="今月は支払われず、次の月以降に残る金額"
                />
              )}
            </div>

            <details
              data-testid="monthly-agreement-payment-details"
              className="group w-full overflow-hidden rounded-lg border border-[#e5e5e7] bg-white"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-2.5 py-2">
                <div>
                  <span className="text-[10px] font-semibold text-[#86868b]">
                    参考情報
                  </span>
                  <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
                    支払い状況と対象PJ
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-[#007aff] group-open:hidden">
                  開く
                </span>
                <span className="hidden text-[11px] font-semibold text-[#007aff] group-open:inline">
                  閉じる
                </span>
              </summary>
              <div className="border-t border-[#e5e5e7] p-2.5">
                <p className="mb-2 text-[11px] leading-relaxed text-[#6e6e73]">
                  支払い済み・支払予定・未払残は、合意する担当内容や予定額そのものではなく、支払いの見通しを知るための情報です。
                </p>
                <dl className="grid gap-x-5 gap-y-1.5 text-[11px] sm:grid-cols-2">
                  <div className="flex items-baseline justify-between gap-3 border-b border-[#f0f0f2] pb-1">
                    <dt className="text-[#6e6e73]">
                      対象PJ <Hint id="monthly-agreement.project-count" />
                    </dt>
                    <dd className="font-semibold tabular-nums text-[#1d1d1f]">
                      {bundle.snapshot.totals.projectCount}件
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-b border-[#f0f0f2] pb-1">
                    <dt className="text-[#6e6e73]">
                      支払済 <Hint id="monthly-agreement.payout" />
                    </dt>
                    <dd className="font-semibold tabular-nums text-[#1d1d1f]">
                      {formatYen(paidActualYen)}
                    </dd>
                  </div>
                  {unverifiedPaidYen > 0 && (
                    <div className="flex items-baseline justify-between gap-3 border-b border-[#f0f0f2] pb-1">
                      <dt className="text-[#6e6e73]">支払い確認中</dt>
                      <dd className="font-semibold tabular-nums text-amber-700">
                        {formatYen(unverifiedPaidYen)}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-3 border-b border-[#f0f0f2] pb-1">
                    <dt className="text-[#6e6e73]">これから支払う予定</dt>
                    <dd className="font-semibold tabular-nums text-[#1d1d1f]">
                      {formatYen(futurePayoutYen)}
                    </dd>
                  </div>
                  {totalStockYen > 0 && (
                    <div className="flex items-baseline justify-between gap-3 border-b border-[#f0f0f2] pb-1">
                      <dt className="text-[#6e6e73]">
                        未払残 <Hint id="monthly-agreement.stock" />
                      </dt>
                      <dd className="font-semibold tabular-nums text-amber-700">
                        {formatYen(totalStockYen)}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 border-t border-[#e5e5e7] pt-2">
                  <p className="text-[10px] font-semibold text-[#86868b]">
                    PJごとの支払い状況
                  </p>
                  {bundle.snapshot.projects.length === 0 ? (
                    <p className="mt-1.5 text-[11px] text-[#6e6e73]">
                      対象PJはありません
                    </p>
                  ) : (
                    <div className="mt-1 divide-y divide-[#e5e5e7]">
                      {bundle.snapshot.projects.map((project) => (
                        <div
                          key={project.projectId}
                          className="grid gap-x-3 gap-y-1 py-2 sm:grid-cols-[minmax(120px,1fr)_auto_auto_auto] sm:items-baseline"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-semibold text-[#1d1d1f]">
                              {project.projectName}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#86868b]">
                              請求 {formatBillingStatus(project.billingStatus)}
                            </p>
                          </div>
                          <p className="text-[10px] text-[#6e6e73]">
                            今月支払{" "}
                            <span className="font-semibold tabular-nums text-[#3c3c43]">
                              {formatYen(project.payoutYen)}
                            </span>
                          </p>
                          <p className="text-[10px] text-[#6e6e73]">
                            {project.paymentYm
                              ? `${formatYm(project.paymentYm)}支払予定`
                              : "支払予定"}{" "}
                            <span className="font-semibold tabular-nums text-[#3c3c43]">
                              {formatYen(project.currentCyclePayoutYen)}
                            </span>
                          </p>
                          <p className="text-[10px] text-[#6e6e73]">
                            未払残{" "}
                            <span className="font-semibold tabular-nums text-amber-700">
                              {formatYen(project.stockYen)}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </details>

            <RewardBasisDetails projects={bundle.snapshot.projects} />

            <section className="flex flex-col items-start gap-4">
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
                    linksInNewTab={false}
                  />
                ))
              )}
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-md border border-[#d1d1d6] bg-white px-3 py-2 text-xs font-semibold text-[#3c3c43]"
              >
                <RefreshCw className="size-3.5" />
                再読み込み
              </button>
            </div>
          </div>
        </details>
      </main>
    </div>
  );
}

function ChangeSummarySection({
  changeSummary,
  projects,
  amountChangeReasons,
  requiredProjectIds,
  missingProjectIds,
  explanations,
  canRequestRevision,
  onRequestRevision,
}: {
  changeSummary: MonthlyAgreementSnapshotDiff;
  projects: MonthlyWorkAgreementProject[];
  amountChangeReasons: MonthlyAgreementAmountChangeReason[];
  requiredProjectIds: string[];
  missingProjectIds: string[];
  explanations: ExpectedRewardChangeExplanation[];
  canRequestRevision: boolean;
  onRequestRevision: (projectId: string) => void;
}) {
  const reasonsByProjectId = new Map(
    amountChangeReasons.map((item) => [item.projectId, item.reason]),
  );
  const explanationByProjectId = new Map(explanations.map((item) => [item.projectId, item]));
  const requiredProjects = requiredProjectIds.flatMap((projectId) => {
    const project = projects.find((item) => item.projectId === projectId);
    const previousProject = changeSummary.groups.find((item) => item.projectId === projectId);
    if (!project && !previousProject) return [];
    return [{
      projectId,
      projectName: project?.projectName ?? previousProject?.projectName ?? projectId,
    }];
  });

  return (
    <section
      data-testid="monthly-agreement-change-summary"
      className="w-full rounded-lg border border-amber-200 bg-amber-50 p-4"
    >
      <p className="text-[14px] font-semibold text-amber-900">
        今回の変更点{" "}
        {changeSummary.comparable ? (
          <span data-testid="monthly-agreement-change-count">
            {changeSummary.count}件
          </span>
        ) : null}
      </p>
      {requiredProjects.length > 0 && (
        <div className="mt-3 border-t border-amber-200 pt-3">
          <p className="text-[12px] font-semibold text-amber-900">
            予定額が変わった理由
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {requiredProjects.map((project) => {
              const missing = missingProjectIds.includes(project.projectId);
              const reason = reasonsByProjectId.get(project.projectId);
              const explanation = explanationByProjectId.get(project.projectId);
              return (
                <div
                  key={project.projectId}
                  data-testid="monthly-agreement-change-reason"
                  className="min-w-0 rounded-md border border-amber-200 bg-white/80 px-3 py-2.5"
                >
                  <p className="break-words text-[12px] font-semibold text-[#1d1d1f]">
                    {project.projectName}
                  </p>
                  {missing ? (
                    <div className="mt-1.5">
                      <p className="text-[13px] font-semibold text-amber-900">
                        変更理由を確認中
                      </p>
                      <p className="mt-0.5 text-[12px] leading-[18px] text-amber-900">
                        管理側が理由を追記するまで合意できません。予定額に違いがある場合は修正要望を送れます。
                      </p>
                      <button
                        type="button"
                        onClick={() => onRequestRevision(project.projectId)}
                        disabled={!canRequestRevision}
                        className="mt-2 min-h-9 rounded-md border border-amber-300 bg-white px-3 text-[12px] font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        この予定額について修正要望
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1.5">
                      {reason && (
                        <p className="break-words text-[13px] leading-[20px] text-[#3c3c43]">{reason}</p>
                      )}
                      {explanation && explanation.details.length > 0 && (
                        <ul
                          data-testid="monthly-agreement-auto-change-explanation"
                          className={`${reason ? "mt-2 border-t border-amber-100 pt-2" : ""} flex list-disc flex-col gap-1 pl-4`}
                        >
                          {explanation.details.map((detail, index) => (
                            <li
                              key={`${project.projectId}-detail-${index}`}
                              className="break-words text-[13px] leading-[20px] text-[#3c3c43]"
                            >
                              {detail}
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        onClick={() => onRequestRevision(project.projectId)}
                        disabled={!canRequestRevision}
                        className="mt-2 min-h-9 rounded-md border border-amber-300 bg-white px-3 text-[12px] font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        この予定額について修正要望
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!changeSummary.comparable ? (
        <p className="mt-1 text-[13px] leading-[20px] text-amber-900">
          {changeSummary.note}
        </p>
      ) : changeSummary.count === 0 ? (
        <p className="mt-1 text-[13px] leading-[20px] text-amber-900">
          前回合意時と現在の合意内容に差があります。
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {changeSummary.groups.map((group) => (
            <div
              key={group.projectId}
              className="min-w-0 rounded-md border border-amber-200 bg-white/70 p-3"
            >
              <p className="break-words text-[12px] font-semibold text-[#1d1d1f]">
                {group.projectName}
              </p>
              <ul className="mt-1.5 flex flex-col gap-2">
                {group.changes.map((change, index) => (
                  <li
                    key={`${group.projectId}-${index}`}
                    className="flex flex-col gap-1 text-[12px] leading-[18px] text-[#3c3c43]"
                  >
                    <span className="break-words font-semibold">{change.label}</span>
                    <span className="grid min-w-0 grid-cols-1 items-start gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                      <span className="min-w-0 break-words text-[#6e6e73]">
                        <span className="block text-xs text-[#6e6e73]">前回</span>
                        {change.before}
                      </span>
                      <ArrowRight className="mx-auto mt-3 size-3 shrink-0 rotate-90 text-amber-700 sm:rotate-0" />
                      <span className="min-w-0 break-words font-semibold text-amber-900">
                        <span className="block text-xs font-normal text-[#6e6e73]">今回</span>
                        {change.after}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RequiredChecksSection({
  compact = false,
  ym,
  projects,
  agreements,
  totalExpectedRewardYen,
  payoutExcluded = false,
  amountChangeReasons,
  requiredProjectIds,
  missingProjectIds,
  explanations,
  canRequestRevision,
  projectScoped,
  savingProjectId,
  onAgree,
  onRequestRevision,
}: {
  compact?: boolean;
  ym: string;
  projects: MonthlyWorkAgreementProject[];
  agreements: MonthlyWorkAgreementProjectAgreement[];
  payoutExcluded?: boolean;
  totalExpectedRewardYen: number | null | undefined;
  amountChangeReasons: MonthlyAgreementAmountChangeReason[];
  requiredProjectIds: string[];
  missingProjectIds: string[];
  explanations: ExpectedRewardChangeExplanation[];
  canRequestRevision: boolean;
  /** この月の合意をPJ単位で成立させるか。false なら合意ボタンは画面下の1つだけ */
  projectScoped: boolean;
  savingProjectId: string | null;
  onAgree: (projectId: string) => void;
  onRequestRevision: (projectId: string, requestType: string) => void;
}) {
  const agreementByProjectId = new Map(agreements.map((item) => [item.projectId, item]));
  const agreedCount = agreements.filter((item) => item.status === "agreed").length;

  return (
    <section
      data-testid="monthly-agreement-required-checks"
      className={`flex w-full max-w-full flex-col ${compact ? "gap-2.5" : "gap-4"}`}
    >
      <div className={compact ? "px-0.5" : "px-1"}>
        <h2 className={`${compact ? "text-[15px] sm:text-[16px]" : "text-[18px] sm:text-[20px]"} font-semibold text-[#1d1d1f]`}>
          確認して合意する内容{" "}
          <span className="inline-flex align-middle [&_button]:h-5 [&_button]:w-5 [&_button]:text-[12px]">
            <Hint id="monthly-agreement.flow" />
          </span>
        </h2>
        <p className={`${compact ? "mt-0.5 text-[11px] leading-4" : "mt-1 text-[13px] leading-[20px]"} text-[#6e6e73]`}>
          {projectScoped
            ? "合意はプロジェクトごとです。あなたが担当する仕事と受け取る額に加えて、同じプロジェクトの全員が今月いくら受け取るかを見たうえで、プロジェクトごとに合意してください。"
            : "あなたが担当する仕事と受け取る額に加えて、同じプロジェクトの全員が今月いくら受け取るかを確認してください。この月の合意はまとめて1回です。"}
        </p>
        {projects.length > 0 && (
          <div className={`${compact ? "mt-1 gap-x-3" : "mt-2 gap-x-5"} flex flex-wrap items-baseline gap-y-1`}>
            {projectScoped && (
            <p className="text-[14px] text-[#3c3c43]">
              合意済み{" "}
              <span
                data-testid="monthly-agreement-agreed-project-count"
                className={`${compact ? "text-[15px]" : "text-[18px]"} font-semibold tabular-nums text-[#1d1d1f]`}
              >
                {agreedCount} / {agreements.length}
              </span>{" "}
              件
            </p>
            )}
            <p className="text-[14px] text-[#3c3c43]">
              {payoutExcluded ? "今月お支払いする額" : "今月受け取る額の合計"}{" "}
              <span className={`${compact ? "text-[16px]" : "text-[20px]"} font-semibold tabular-nums text-[#1d1d1f]`}>
                {formatYen(totalExpectedRewardYen)}
              </span>
            </p>
          </div>
        )}
      </div>

      {projects.length === 0 ? (
        <section className="w-full rounded-lg border border-[#e5e5e7] bg-white p-4">
          <p className="text-[14px] text-[#6e6e73]">対象のプロジェクトはありません</p>
        </section>
      ) : (
        projects.map((project) => (
          <ProjectAgreementBlock
            key={project.projectId}
            compact={compact}
            ym={ym}
            project={project}
            agreement={agreementByProjectId.get(project.projectId) ?? null}
            payoutExcluded={payoutExcluded}
            amountChangeReasons={amountChangeReasons.filter((item) => item.projectId === project.projectId)}
            requiredProjectIds={requiredProjectIds.filter((id) => id === project.projectId)}
            missingProjectIds={missingProjectIds.filter((id) => id === project.projectId)}
            explanations={explanations.filter((item) => item.projectId === project.projectId)}
            canRequestRevision={canRequestRevision}
            projectScoped={projectScoped}
            saving={savingProjectId === project.projectId}
            savingOther={savingProjectId != null && savingProjectId !== project.projectId}
            onAgree={onAgree}
            onRequestRevision={onRequestRevision}
          />
        ))
      )}
    </section>
  );
}

function projectAgreementStatusStyle(status: MonthlyAgreementStatus | undefined) {
  if (status === "agreed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "needs_reagreement") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-[#d1d1d6] bg-[#f5f5f7] text-[#3c3c43]";
}

function projectAgreementStatusLabel(status: MonthlyAgreementStatus | undefined) {
  if (status === "agreed") return "合意済み";
  if (status === "needs_reagreement") return "条件更新あり";
  return "未合意";
}

/**
 * PJ1件分の合意ブロック。担当する仕事 → 自分が受け取る額 → PJ全員の配分 → 合意 の順に置く。
 *
 * 配分表を必須確認に入れているのは、自分の額が妥当かどうかは同じ原資を分け合う他の人の額を
 * 見ないと判断できないから (まさ確定 2026-08-28)。
 */
function ProjectAgreementBlock({
  compact,
  ym,
  project,
  agreement,
  payoutExcluded,
  amountChangeReasons,
  requiredProjectIds,
  missingProjectIds,
  explanations,
  canRequestRevision,
  projectScoped,
  saving,
  savingOther,
  onAgree,
  onRequestRevision,
}: {
  compact: boolean;
  ym: string;
  project: MonthlyWorkAgreementProject;
  agreement: MonthlyWorkAgreementProjectAgreement | null;
  payoutExcluded: boolean;
  amountChangeReasons: MonthlyAgreementAmountChangeReason[];
  requiredProjectIds: string[];
  missingProjectIds: string[];
  explanations: ExpectedRewardChangeExplanation[];
  canRequestRevision: boolean;
  projectScoped: boolean;
  saving: boolean;
  savingOther: boolean;
  onAgree: (projectId: string) => void;
  onRequestRevision: (projectId: string, requestType: string) => void;
}) {
  const status = agreement?.status;
  const roleText =
    [project.roleLabel, project.isPm ? "PM" : null, project.isPl ? "PL" : null]
      .filter(Boolean)
      .join(" / ") || null;
  const carryInYen = project.carryInYen ?? 0;
  const stockYen = project.stockYen ?? 0;
  // 発生額は配分表の自分の行と同じ数字を出す。同じ画面で2つの定義の「今月発生する額」を出さない
  const selfAccrualYen =
    project.memberAllocations.find((row) => row.isSelf)?.accrualYen ?? project.currentMonthAccrualYen;

  return (
    <section
      data-testid="monthly-agreement-project-block"
      data-project-id={project.projectId}
      className={`w-full max-w-full rounded-lg border border-[#e5e5e7] bg-white ${compact ? "p-3" : "p-4 sm:p-6"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={`${compact ? "text-[15px] sm:text-[16px]" : "text-[18px] sm:text-[20px]"} break-words font-semibold text-[#1d1d1f]`}>
            {project.projectName}
          </h3>
          {roleText && <p className="mt-0.5 text-[13px] text-[#6e6e73]">{roleText}</p>}
        </div>
        {projectScoped && (
          <span
            data-testid="monthly-agreement-project-status"
            className={`shrink-0 rounded-full border px-3 py-1 text-[13px] font-semibold ${projectAgreementStatusStyle(status)}`}
          >
            {projectAgreementStatusLabel(status)}
          </span>
        )}
      </div>

      <div className={compact ? "mt-3" : "mt-4"}>
        <div className="flex items-center gap-2">
          <SectionNumberBadge number="01" />
          <h4 className={`${compact ? "text-[13px] sm:text-[14px]" : "text-[16px] sm:text-[18px]"} font-semibold text-[#1d1d1f]`}>
            あなたが担当する仕事
          </h4>
        </div>
        {project.milestones.length === 0 ? (
          <p className="mt-2 text-[14px] text-amber-700">担当内容が未登録です</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {project.milestones.map((milestone) => (
              <li
                key={milestone.milestoneId}
                data-testid="monthly-agreement-check-scope"
                className={`flex min-w-0 items-start gap-1.5 ${compact ? "text-[12px] leading-[18px]" : "text-[14px] leading-[22px]"} text-[#3c3c43]`}
              >
                <span aria-hidden="true" className="text-[#86868b]">
                  ・
                </span>
                <span className="min-w-0 break-words">
                  {milestone.taskDescription || milestone.title}
                </span>
              </li>
            ))}
          </ul>
        )}
        {project.routineExpectations.length > 0 && (
          <p className="mt-2 text-[13px] leading-[20px] text-[#6e6e73]">
            定常業務: {project.routineExpectations.join(" / ")}
          </p>
        )}
      </div>

      <div className={compact ? "mt-3" : "mt-5"}>
        <div className="flex items-center gap-2">
          <SectionNumberBadge number="02" />
          <h4 className={`${compact ? "text-[13px] sm:text-[14px]" : "text-[16px] sm:text-[18px]"} font-semibold text-[#1d1d1f]`}>
            その対価としてあなたが受け取る額
          </h4>
        </div>
        <div className={`mt-2 rounded-lg border border-[#dbeafe] bg-sky-50 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
          <p
            data-testid="monthly-agreement-check-reward"
            className={`${compact ? "text-[20px] sm:text-[22px]" : "text-[26px] sm:text-[28px]"} font-bold tabular-nums text-sky-950`}
          >
            {formatYen(project.expectedRewardYen)}
          </p>
          <p className={`${compact ? "mt-0.5 text-[11px] leading-4" : "mt-1 text-[13px] leading-[20px]"} text-sky-900`}>
            今月の担当分から発生する額は {formatYen(selfAccrualYen)}
            {carryInYen > 0 ? `、これまで支払いを待ってもらっている分の返済を含みます` : ""}
            {stockYen > 0 ? `。今月末に残る未払い分は ${formatYen(stockYen)}` : ""}
          </p>
          {payoutExcluded && (
            <p
              data-testid="monthly-agreement-payout-excluded-note"
              className="mt-2 text-[13px] leading-[20px] text-sky-900"
            >
              あなたは支払通知書の対象外です。担当分から発生する額は現金ではお支払いせず、会社の内部配賦として扱います。
            </p>
          )}
        </div>
      </div>

      <div className={compact ? "mt-3" : "mt-5"}>
        <div className="flex items-center gap-2">
          <SectionNumberBadge number="03" />
          <h4 className={`${compact ? "text-[13px] sm:text-[14px]" : "text-[16px] sm:text-[18px]"} font-semibold text-[#1d1d1f]`}>
            このプロジェクトの今月の配分
          </h4>
        </div>
        <p className={`${compact ? "mt-1 text-[11px] leading-4" : "mt-2 text-[13px] leading-[20px]"} text-[#6e6e73]`}>
          同じプロジェクトの全員が、今月それぞれいくら受け取るかです。発生する額は、担当した仕事の消化ptとMSごとの単価から決まります。全員で同じ原資を分け合うので、誰かの取り分を増やすと他の人の取り分が減ります。
        </p>
        <ProjectAllocationTable project={project} />
      </div>

      <SeasonRewardTrend project={project} ym={ym} compact={compact} />

      {status === "needs_reagreement" && agreement?.changeSummary && (
        <div className="mt-5">
          <ChangeSummarySection
            changeSummary={agreement.changeSummary}
            projects={[project]}
            amountChangeReasons={amountChangeReasons}
            requiredProjectIds={requiredProjectIds}
            missingProjectIds={missingProjectIds}
            explanations={explanations}
            canRequestRevision={canRequestRevision}
            onRequestRevision={(projectId) => onRequestRevision(projectId, "reward")}
          />
        </div>
      )}

      <div className={`${compact ? "mt-3 pt-3" : "mt-5 pt-4"} border-t border-[#e5e5e7]`}>
        {projectScoped && agreement && !agreement.canAgree && agreement.blockedReason && (
          <p
            data-testid="monthly-agreement-missing-change-reason"
            className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-[20px] text-amber-900"
          >
            {agreement.blockedReason}
          </p>
        )}
        {projectScoped && status !== "agreed" && (
          <p className="mb-3 text-[13px] leading-[20px] text-[#3c3c43]">
            上の内容を確認したうえで、このプロジェクトの内容に合意してください。合意が終わるまで、このプロジェクトの今月分の支払いには進めません。
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {projectScoped && (
          <button
            type="button"
            data-testid="monthly-agreement-agree-button"
            onClick={() => onAgree(project.projectId)}
            disabled={saving || savingOther || status === "agreed" || !agreement?.canAgree}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#007aff] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#006edb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-auto sm:px-4 sm:text-[14px]"
            title={
              agreement && !agreement.canAgree
                ? agreement.blockedReason || "本人だけが合意できます"
                : `${project.projectName} の担当内容と配分を確認して合意`
            }
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
            {status === "agreed" ? "合意済み" : `${project.projectName} に合意する`}
          </button>
          )}
          <button
            type="button"
            data-testid="monthly-agreement-project-revision-button"
            onClick={() => onRequestRevision(project.projectId, "reward")}
            disabled={!canRequestRevision}
            className="inline-flex h-11 w-full items-center justify-center gap-1 rounded-md border border-[#d1d1d6] bg-transparent px-3 text-[13px] font-semibold text-[#3c3c43] opacity-80 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-auto sm:px-3 sm:text-[13px]"
          >
            <Send className="size-3" />
            このPJの内容が違う
          </button>
        </div>
      </div>
    </section>
  );
}

function allocationShareText(share: number | null) {
  if (share == null) return "—";
  const pct = share * 100;
  return `${pct >= 1 ? Math.round(pct) : Math.round(pct * 10) / 10}%`;
}

/**
 * PJの当月配分。全メンバー分を並べる。
 *
 * 狭い画面では表を出さず密なリストにする。表を横スクロールさせると、
 * モバイルでは肝心の金額が初期表示の外へ出る。
 */
function ProjectAllocationTable({ project }: { project: MonthlyWorkAgreementProject }) {
  const rows = project.memberAllocations;
  if (rows.length === 0) {
    return (
      <p className="mt-2 text-[13px] text-[#6e6e73]">
        このプロジェクトの今月の配分はまだ確定していません。
      </p>
    );
  }
  const totals = project.allocationTotals;

  return (
    <div data-testid="monthly-agreement-allocation-table" className="mt-2 w-full max-w-full">
      <ul className="divide-y divide-[#f0f0f2] rounded-md border border-[#e5e5e7] sm:hidden">
        {rows.map((row) => (
          <li key={row.memberId} className={`px-3 py-2.5 ${row.isSelf ? "bg-sky-50" : ""}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 break-words text-[14px] font-semibold text-[#1d1d1f]">
                {row.codeName}
                {row.isSelf && <span className="ml-1 text-[12px] text-sky-800">（あなた）</span>}
              </p>
              <p className="shrink-0 text-[15px] font-semibold tabular-nums text-[#1d1d1f]">
                {formatYen(row.payYen)}
              </p>
            </div>
            <p className="mt-0.5 text-[12px] text-[#6e6e73]">
              今月発生 <span className="font-semibold tabular-nums text-[#3c3c43]">{formatYen(row.accrualYen)}</span>
              <span className="mx-1.5">・</span>取り分{" "}
              <span className="font-semibold tabular-nums text-[#3c3c43]">{allocationShareText(row.accrualShare)}</span>
              <span className="mx-1.5">・</span>
              <span className="tabular-nums">{formatPt(row.earnedPt)}</span>
              {(row.isPm || row.isPl || row.roleLabel) && (
                <span className="ml-1.5">
                  ・{[row.roleLabel, row.isPm ? "PM" : null, row.isPl ? "PL" : null].filter(Boolean).join(" / ")}
                </span>
              )}
            </p>
            {row.taskSummaries.length > 0 && (
              <p className="mt-1 line-clamp-3 break-words text-[12px] leading-[18px] text-[#3c3c43]">
                {row.taskSummaries.join(" / ")}
              </p>
            )}
          </li>
        ))}
        <li className="bg-[#f5f5f7] px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="whitespace-nowrap text-[13px] font-semibold text-[#1d1d1f]">
              {totals.memberCount}人 合計
            </p>
            <p className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-[#1d1d1f]">
              {formatYen(totals.payYen)}
            </p>
          </div>
          <p className="mt-0.5 text-[12px] text-[#6e6e73]">
            今月発生{" "}
            <span className="font-semibold tabular-nums text-[#3c3c43]">{formatYen(totals.accrualYen)}</span>
          </p>
        </li>
      </ul>

      <div className="hidden w-full max-w-full overflow-x-auto rounded-md border border-[#e5e5e7] sm:block">
        <table className="w-full min-w-[620px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[#e5e5e7] bg-[#f5f5f7] text-left text-[12px] text-[#6e6e73]">
              <th className="whitespace-nowrap px-3 py-2 font-semibold">メンバー</th>
              <th className="px-3 py-2 font-semibold">今月の担当</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">今月のpt</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">取り分</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">今月発生する額</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">今月受け取る額</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f2]">
            {rows.map((row) => (
              <tr key={row.memberId} className={row.isSelf ? "bg-sky-50" : undefined}>
                <td className="whitespace-nowrap px-3 py-2 align-top">
                  <span className="font-semibold text-[#1d1d1f]">{row.codeName}</span>
                  {row.isSelf && <span className="ml-1 text-[12px] text-sky-800">（あなた）</span>}
                  {(row.isPm || row.isPl || row.roleLabel) && (
                    <span className="mt-0.5 block text-[12px] text-[#86868b]">
                      {[row.roleLabel, row.isPm ? "PM" : null, row.isPl ? "PL" : null]
                        .filter(Boolean)
                        .join(" / ")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-[13px] leading-[19px] text-[#3c3c43]">
                  {row.taskSummaries.length > 0 ? row.taskSummaries.join(" / ") : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-[#3c3c43]">
                  {formatPt(row.earnedPt)}
                </td>
                <td className="px-3 py-2 text-right align-top tabular-nums text-[#3c3c43]">
                  {allocationShareText(row.accrualShare)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums text-[#1d1d1f]">
                  {formatYen(row.accrualYen)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right align-top font-semibold tabular-nums text-[#1d1d1f]">
                  {formatYen(row.payYen)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#e5e5e7] bg-[#f5f5f7] text-[13px]">
              <td className="px-3 py-2 font-semibold text-[#1d1d1f]">合計</td>
              <td className="px-3 py-2 text-[12px] text-[#6e6e73]">{totals.memberCount}人</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#1d1d1f]">
                {formatPt(totals.earnedPt)}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#1d1d1f]">100%</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#1d1d1f]">
                {formatYen(totals.accrualYen)}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#1d1d1f]">
                {formatYen(totals.payYen)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  );
}

function addYm(ym: string, delta: number) {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** MSの期間表記。同じ年の中なら年を省く */
function periodLabel(fromYm: string, toYm: string) {
  const fromMonth = Number(fromYm.slice(4, 6));
  const toMonth = Number(toYm.slice(4, 6));
  if (fromYm.slice(0, 4) === toYm.slice(0, 4)) {
    return fromYm === toYm ? `${fromMonth}月` : `${fromMonth}月 〜 ${toMonth}月`;
  }
  return `${fromYm.slice(2, 4)}/${fromMonth} 〜 ${toYm.slice(2, 4)}/${toMonth}`;
}

/** 月軸の見出し。年が変わる月と先頭だけ年を出す */
function axisMonthLabel(ym: string, previousYm: string | null) {
  const month = Number(ym.slice(4, 6));
  const showYear = previousYm == null || ym.slice(0, 4) !== previousYm.slice(0, 4);
  return showYear ? `${ym.slice(2, 4)}/${month}` : `${month}月`;
}

/** シーズン (plan cycle) の全月。plan cycle が無いPJは支払予定のある月から組み立てる */
function seasonMonths(project: MonthlyWorkAgreementProject): string[] {
  const scheduleYms = project.payoutSchedule.map((entry) => entry.sourceYm).filter(Boolean);
  const start =
    project.seasonStartYm ?? (scheduleYms.length ? scheduleYms.reduce((a, b) => (a < b ? a : b)) : null);
  const end = project.seasonEndYm ?? (scheduleYms.length ? scheduleYms.reduce((a, b) => (a > b ? a : b)) : null);
  if (!start || !end || start > end) return [];
  const months: string[] = [];
  let cursor = start;
  while (cursor <= end && months.length < 36) {
    months.push(cursor);
    cursor = addYm(cursor, 1);
  }
  return months;
}

/**
 * シーズン全月の報酬推移と、担当MSがどの期間に割り当たっているか。
 *
 * 同じ月軸に棒とMSの期間を並べる。まさ 2026-08-29「各MSがどの期間に割り当てられているかも
 * 矢印とかで表示してあげると、ああこのMSが始まるからここから報酬が高くなるんだ、とかも分かりやすい」。
 */
function SeasonRewardTrend({ project, ym, compact = false }: { project: MonthlyWorkAgreementProject; ym: string; compact?: boolean }) {
  const months = seasonMonths(project);
  if (months.length === 0) return null;

  const entryByYm = new Map(project.payoutSchedule.map((entry) => [entry.sourceYm, entry]));
  const cells = months.map((month) => {
    const entry = entryByYm.get(month) ?? null;
    return {
      ym: month,
      payYen: entry?.totalPayYen ?? 0,
      accrualYen: entry?.basePayYen ?? 0,
      stockYen: entry?.stockYen ?? 0,
      isCurrent: month === ym,
      isPast: month < ym,
      isPaid: Boolean(entry?.isActualPaid),
      hasEntry: entry != null,
    };
  });
  const maxYen = Math.max(1, ...cells.map((cell) => cell.payYen));
  const seasonTotalYen = cells.reduce((sum, cell) => sum + cell.payYen, 0);
  const paidTotalYen = cells.filter((cell) => cell.isPaid).reduce((sum, cell) => sum + cell.payYen, 0);
  const remainingYen = Math.max(0, seasonTotalYen - paidTotalYen);

  const milestoneBars = project.milestones
    .map((milestone) => {
      const startIndex = milestone.periodStartYm ? months.indexOf(milestone.periodStartYm) : -1;
      const endIndex = milestone.targetYm ? months.indexOf(milestone.targetYm) : -1;
      // シーズンの外へはみ出すMSは、見えている範囲へ寄せる
      const from = startIndex >= 0 ? startIndex : milestone.periodStartYm && milestone.periodStartYm < months[0] ? 0 : -1;
      const to =
        endIndex >= 0
          ? endIndex
          : milestone.targetYm && milestone.targetYm > months[months.length - 1]
            ? months.length - 1
            : -1;
      if (from < 0 || to < 0 || to < from) return null;
      return { milestone, from, to };
    })
    .filter((bar): bar is { milestone: MonthlyWorkAgreementMilestone; from: number; to: number } => bar != null)
    .sort((a, b) => a.from - b.from || a.to - b.to);

  const gridTemplate = {
    gridTemplateColumns: `128px repeat(${months.length}, minmax(66px, 1fr))`,
    minWidth: `${128 + months.length * 66}px`,
  };

  return (
    <div className={compact ? "mt-3" : "mt-5"}>
      <div className={compact ? "flex items-center gap-1.5" : "flex items-center gap-2"}>
        <SectionNumberBadge number="04" />
        <h4 className={`${compact ? "text-[13px] sm:text-[14px]" : "text-[16px] sm:text-[18px]"} font-semibold text-[#1d1d1f]`}>
          このシーズンの報酬の見通し
        </h4>
      </div>
      <p className={`${compact ? "mt-1 text-[11px] leading-4" : "mt-2 text-[13px] leading-[20px]"} text-[#6e6e73]`}>
        {formatYm(months[0])}から{formatYm(months[months.length - 1])}まで、あなたがこのプロジェクトで月ごとにいくら受け取るかです。下の帯は、担当しているMSがどの期間に割り当たっているかを同じ月の並びで示しています。MSが始まる月から受け取る額が増えます。
      </p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-[#3c3c43]">
        <span>
          シーズン合計{" "}
          <span className="text-[16px] font-semibold tabular-nums text-[#1d1d1f]">{formatYen(seasonTotalYen)}</span>
        </span>
        <span>
          受け取り済み{" "}
          <span className="font-semibold tabular-nums text-emerald-700">{formatYen(paidTotalYen)}</span>
        </span>
        <span>
          これから{" "}
          <span className="font-semibold tabular-nums text-[#1d1d1f]">{formatYen(remainingYen)}</span>
        </span>
      </div>

      <div
        data-testid="monthly-agreement-season-trend"
        className="mt-2 w-full max-w-full overflow-x-auto rounded-md border border-[#e5e5e7]"
      >
        <div className="min-w-fit">
          {/* 金額を固定の行にして、その下に同じ基準の高さで棒を置く。
              金額を棒の先端に付けると、額の小さい月で棒がつぶれて比較できなくなる */}
          <div className="grid border-b border-[#f0f0f2]" style={gridTemplate}>
            <div className="sticky left-0 z-10 row-span-2 border-r border-[#e5e5e7] bg-white px-3 py-2">
              <p className="text-[12px] font-semibold text-[#6e6e73]">受け取る額</p>
              <p className="mt-0.5 text-[12px] leading-[16px] text-[#86868b]">税抜・稼働した月ごと</p>
            </div>
            {cells.map((cell) => (
              <div
                key={`amount-${cell.ym}`}
                className={`px-1 pt-2 text-center text-[12px] tabular-nums ${
                  cell.isCurrent
                    ? "bg-sky-50 font-semibold text-sky-900"
                    : cell.payYen > 0
                      ? "font-semibold text-[#1d1d1f]"
                      : "text-[#c7c7cc]"
                }`}
              >
                {cell.payYen > 0 ? formatYen(cell.payYen) : "—"}
              </div>
            ))}
            {cells.map((cell) => (
              <div
                key={`bar-${cell.ym}`}
                title={`${formatYm(cell.ym)}: 受け取る額 ${formatYen(cell.payYen)} / 発生する額 ${formatYen(cell.accrualYen)}${cell.stockYen > 0 ? ` / 月末に残る未払い ${formatYen(cell.stockYen)}` : ""}`}
                className={`flex h-[88px] items-end px-1 pb-1 ${cell.isCurrent ? "bg-sky-50" : ""}`}
              >
                <div
                  className={`w-full rounded-t-[3px] ${
                    cell.isPaid ? "bg-emerald-500" : cell.isCurrent ? "bg-sky-600" : cell.isPast ? "bg-sky-300" : "bg-sky-400"
                  }`}
                  style={{ height: `${cell.payYen > 0 ? Math.max(6, (cell.payYen / maxYen) * 80) : 0}px` }}
                />
              </div>
            ))}
          </div>

          {/* 月ラベル。当月を強調する */}
          <div className="grid border-b border-[#e5e5e7] bg-[#f5f5f7]" style={gridTemplate}>
            <div className="sticky left-0 z-10 border-r border-[#e5e5e7] bg-[#f5f5f7] px-3 py-1.5 text-[12px] font-semibold text-[#6e6e73]">
              月
            </div>
            {cells.map((cell, index) => (
              <div
                key={cell.ym}
                className={`px-1 py-1.5 text-center text-[12px] tabular-nums ${
                  cell.isCurrent ? "bg-sky-100 font-semibold text-sky-900" : "text-[#6e6e73]"
                }`}
              >
                {axisMonthLabel(cell.ym, index === 0 ? null : cells[index - 1].ym)}
              </div>
            ))}
          </div>

          {/* 担当MSの期間。棒グラフと同じ月の並びに合わせる */}
          {milestoneBars.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-[#6e6e73]">担当MSの期間が未登録です</div>
          ) : (
            milestoneBars.map(({ milestone, from, to }) => (
              <div
                key={milestone.milestoneId}
                className="grid items-center border-b border-[#f0f0f2] last:border-b-0"
                style={gridTemplate}
              >
                <div className="sticky left-0 z-10 h-full border-r border-[#e5e5e7] bg-white px-3 py-2">
                  <p
                    title={milestone.title}
                    className="line-clamp-2 break-words text-[12px] font-semibold leading-[16px] text-[#1d1d1f]"
                  >
                    {milestone.title}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-[16px] text-[#86868b]">
                    {milestone.points}pt
                    {milestone.plannedShare != null && `・担当 ${Math.round(milestone.plannedShare * 100)}%`}
                  </p>
                </div>
                {/* バーは1つの grid セルとして描き、開始月から終了月までをまたぐ */}
                <div
                  className="px-1 py-2"
                  style={{ gridColumn: `${from + 2} / ${to + 3}` }}
                  title={`${milestone.title}: ${formatYm(months[from])} 〜 ${formatYm(months[to])}`}
                >
                  <div className="flex h-6 items-center rounded-full bg-indigo-100 px-2 text-[12px] font-semibold text-indigo-900">
                    <span className="truncate">{periodLabel(months[from], months[to])}</span>
                  </div>
                </div>
                {/* 残りの月は空セルで埋め、次の行の列がずれないようにする */}
                {to + 1 < months.length && <div style={{ gridColumn: `${to + 3} / -1` }} />}
              </div>
            ))
          )}
        </div>
      </div>

      <p className="mt-2 text-[12px] leading-[18px] text-[#6e6e73]">
        緑は受け取り済み、濃い青は今月、薄い青はこれから受け取る分です。金額は税抜で、実際の振込はこれに消費税を足した額になります。
      </p>
    </div>
  );
}

function SectionNumberBadge({ number }: { number: "01" | "02" | "03" | "04" }) {
  // 静的な文字列で書く。テンプレートで組むと critical UI guard が testid を追えない
  const testId =
    number === "01"
      ? "monthly-agreement-section-number-01"
      : number === "02"
        ? "monthly-agreement-section-number-02"
        : number === "03"
          ? "monthly-agreement-section-number-03"
          : "monthly-agreement-section-number-04";
  return (
    <span
      data-testid={testId}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#007aff] text-[14px] font-bold text-white"
    >
      {number}
    </span>
  );
}

function RewardBasisDetails({
  projects,
}: {
  projects: MonthlyWorkAgreementProject[];
}) {
  return (
    <details
      data-testid="monthly-agreement-reward-basis-details"
      className="group w-full overflow-hidden rounded-lg border border-[#e5e5e7] bg-white"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-2.5 py-2">
        <div>
          <span className="text-[10px] font-semibold text-[#86868b]">
            参考情報
          </span>
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
            予定額の根拠
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-[#007aff] group-open:hidden">
          開く
        </span>
        <span className="hidden text-[11px] font-semibold text-[#007aff] group-open:inline">
          閉じる
        </span>
      </summary>
      <div className="border-t border-[#e5e5e7] p-2.5">
        <p className="mb-2 text-[11px] leading-relaxed text-[#6e6e73]">
          予定額は、担当割合と今月のptから算出しています。
        </p>
        {projects.length === 0 ? (
          <p className="text-[11px] text-[#6e6e73]">対象PJはありません</p>
        ) : (
          projects.map((project) => (
            <div key={project.projectId} className="mb-3 last:mb-0">
              <p className="text-[11px] font-semibold text-[#1d1d1f]">
                {project.projectName}
              </p>
              {project.milestones.length === 0 ? (
                <p className="mt-1 text-[11px] text-[#6e6e73]">
                  担当内容が未登録です
                </p>
              ) : (
                <div className="mt-1 divide-y divide-[#e5e5e7] border-t border-[#e5e5e7]">
                  {project.milestones.map((ms) => (
                    <div
                      key={ms.milestoneId}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 text-[11px]"
                    >
                      <span className="min-w-0 truncate font-semibold text-[#3c3c43]">
                        {ms.title}
                      </span>
                      <span className="whitespace-nowrap tabular-nums text-[#6e6e73]">
                        担当割合{" "}
                        {ms.plannedShare == null
                          ? "未設定"
                          : `${Math.round(ms.plannedShare * 100)}%`}{" "}
                        / 今月のpt {formatPt(ms.earnedPt)} / 予定額{" "}
                        {formatYen(ms.expectedRewardYen)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </details>
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
                    {compact ? "担当内容の詳細" : "今シーズンのMS"}{" "}
                    <Hint id="monthly-agreement.ms-pt" />
                  </h3>
                  <p
                    className={`${compact ? "mt-0.5" : "mt-1"} text-[11px] leading-relaxed text-[#6e6e73]`}
                  >
                    {compact
                      ? "上の必須確認に対する、担当内容の詳しい一覧です。pt・担当割合は予定額の根拠です。"
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
