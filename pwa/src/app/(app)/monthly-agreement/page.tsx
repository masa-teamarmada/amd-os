"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleDollarSign, FileCheck2, Loader2, RefreshCw } from "lucide-react";
import type { MonthlyWorkAgreementBundle, MonthlyWorkAgreementProject } from "@/lib/monthly-work-agreement-types";

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

function statusLabel(status: MonthlyWorkAgreementBundle["status"]) {
  if (status === "agreed") return "合意済み";
  if (status === "needs_reagreement") return "条件更新あり";
  return "未合意";
}

function statusClass(status: MonthlyWorkAgreementBundle["status"]) {
  if (status === "agreed") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "needs_reagreement") return "border-amber-200 bg-amber-50 text-amber-900";
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

  const unresolved = useMemo(
    () => bundle?.snapshot.projects.filter((project) => project.conditionState === "review_required") ?? [],
    [bundle],
  );

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

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-12">
      <div className="border-b border-[#e5e5e7] bg-white px-4 py-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#86868b]">Monthly Agreement</p>
            <h1 className="mt-1 text-[22px] font-semibold text-[#1d1d1f]">{formatYm(bundle.ym)}の遂行内容と報酬条件</h1>
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
                      ? "前回合意後に条件snapshotが変わっています。内容を確認して再合意してください。"
                      : "業務開始前に、今月の遂行内容・条件・想定報酬を確認して合意してください。"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAgree}
              disabled={saving || bundle.status === "agreed" || !bundle.tableReady || !bundle.canAgree}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              title={!bundle.canAgree ? "本人だけが合意を保存できます" : "今月の遂行内容と報酬条件を確認して合意"}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
              {bundle.status === "agreed" ? "合意済み" : "確認して合意"}
            </button>
          </div>
          {!bundle.tableReady && (
            <p className="mt-3 rounded-md border border-red-200 bg-white/70 px-3 py-2 text-xs text-red-700">
              合意保存テーブルが未適用です。migration適用後に保存できます。
            </p>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="参加PJ" value={`${bundle.snapshot.totals.projectCount}`} />
          <MetricCard label="想定報酬合計" value={formatYen(bundle.snapshot.totals.expectedRewardYen)} />
          <MetricCard label="未確定/要確認" value={`${bundle.snapshot.totals.reviewRequiredCount}`} emphasis={unresolved.length > 0} />
        </section>

        {unresolved.length > 0 && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-sm font-semibold">未確定・要確認が残っています</p>
                <p className="mt-1 text-xs leading-relaxed">
                  合意は保存できますが、報酬キャッシュ未生成、MS/share未設定、cap未確定などは admin/PM 側で確認が必要です。
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-4">
          {bundle.snapshot.projects.length === 0 ? (
            <div className="rounded-lg border border-[#e5e5e7] bg-white p-5 text-sm text-[#6e6e73]">
              {formatYm(bundle.ym)}に参加中のPJはありません。
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
  return (
    <article className="rounded-lg border border-[#e5e5e7] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">{project.projectName}</h2>
            {project.conditionState === "review_required" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">要確認</span>
            )}
            {project.isPm && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">PM</span>}
            {project.isPl && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">PL</span>}
          </div>
          <p className="mt-1 text-xs text-[#86868b]">{project.projectId} / billing {project.billingStatus || "未作成"}</p>
        </div>
        <div className="rounded-md bg-[#f5f5f7] px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-[#86868b]">
            <CircleDollarSign className="size-3.5" />
            想定報酬
          </div>
          <p className="mt-1 text-[20px] font-semibold tabular-nums text-[#1d1d1f]">{formatYen(project.expectedRewardYen)}</p>
          {project.earnedPt != null && <p className="text-[11px] text-[#86868b]">{project.earnedPt.toFixed(1)} pt</p>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-[#e5e5e7] p-3">
          <p className="text-[12px] font-semibold text-[#1d1d1f]">遂行条件</p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-[#3c3c43]">
            {project.conditions.map((condition) => <li key={condition}>・{condition}</li>)}
            {project.routineExpectations.map((condition) => <li key={condition}>・{condition}</li>)}
          </ul>
        </div>
        <div className="rounded-md border border-[#e5e5e7] p-3">
          <p className="text-[12px] font-semibold text-[#1d1d1f]">未確定・要確認</p>
          {project.reviewReasons.length === 0 ? (
            <p className="mt-2 text-[12px] text-emerald-700">現時点の表示条件では大きな未確定はありません。</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-amber-800">
              {project.reviewReasons.map((reason) => <li key={reason}>・{reason}</li>)}
            </ul>
          )}
        </div>
      </div>

      {project.milestones.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-md border border-[#e5e5e7]">
          <div className="grid grid-cols-[minmax(0,1fr)_82px_92px] bg-[#f5f5f7] px-3 py-2 text-[11px] font-semibold text-[#6e6e73]">
            <span>遂行対象</span>
            <span className="text-right">share</span>
            <span className="text-right">進捗</span>
          </div>
          <div className="divide-y divide-[#e5e5e7]">
            {project.milestones.map((ms) => (
              <div key={ms.milestoneId} className="grid grid-cols-[minmax(0,1fr)_82px_92px] gap-2 px-3 py-2 text-[12px]">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1d1d1f]">{ms.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#86868b]">{ms.taskDescription || ms.conditions.join(" / ")}</p>
                </div>
                <span className="text-right tabular-nums text-[#3c3c43]">{ms.plannedShare == null ? "未設定" : `${Math.round(ms.plannedShare * 100)}%`}</span>
                <span className="text-right tabular-nums text-[#3c3c43]">{ms.progressPct == null ? "未生成" : `${ms.progressPct.toFixed(1)}%`}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
