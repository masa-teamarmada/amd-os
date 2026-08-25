"use client";

/**
 * `/admin/payouts` のメンバー行をクリックしたときに出る「支払額の内訳」。
 *
 * 出す情報は3つ。
 *   1. 当月発生した額が、どのMSの進み × 担当割合 × 1pt単価 から来たのか
 *   2. 当月いくらまで払える枠があり、いくら払ったのか
 *   3. 繰越が、どの稼働月の未払い分なのか
 * 金額は `/api/admin/payouts/member-breakdown` が返す保存済み報酬キャッシュそのままで、
 * 一覧の行と必ず一致する (このモーダルでは再計算しない)。
 */

import { useEffect, useState } from "react";
import type { MemberPayoutBreakdown } from "@/lib/reward-member-breakdown";

function fmtYm(ym: string) {
  return ym && ym.length === 6 ? `${ym.slice(0, 4)}/${ym.slice(4)}` : ym;
}

function fmtYen(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function fmtPt(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 100) / 100}pt`;
}

function fmtPct(share: number) {
  const n = Number(share ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
}

export function MemberPayoutBreakdownModal({
  projectId,
  ym,
  memberId,
  fallbackLabel,
  onClose,
  onOpenMsProgress,
}: {
  projectId: string;
  ym: string;
  memberId: string;
  fallbackLabel: string;
  onClose: () => void;
  onOpenMsProgress: () => void;
}) {
  const [data, setData] = useState<MemberPayoutBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 呼び出し側が projectId:ym:memberId を key にして作り直すので、
  // effect の中で state を初期化し直さない (初期値がそのまま「読み込み中」)。
  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/admin/payouts/member-breakdown?projectId=${encodeURIComponent(projectId)}&ym=${encodeURIComponent(ym)}&memberId=${encodeURIComponent(memberId)}`,
      { cache: "no-store" }
    )
      .then(async (res) => {
        const payload = (await res.json()) as { ok?: boolean; error?: string; breakdown?: MemberPayoutBreakdown };
        if (cancelled) return;
        if (!res.ok || !payload.ok || !payload.breakdown) {
          setError(payload.error || `内訳を取得できなかった (${res.status})`);
          return;
        }
        setData(payload.breakdown);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "内訳を取得できなかった");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, ym, memberId]);

  return (
    <MemberPayoutBreakdownView
      data={data}
      loading={loading}
      error={error}
      fallbackLabel={fallbackLabel}
      onClose={onClose}
      onOpenMsProgress={onOpenMsProgress}
    />
  );
}

/** 表示だけを持つ本体。取得と分離してあるのは、内訳の見た目を単体で確認できるようにするため。 */
export function MemberPayoutBreakdownView({
  data,
  loading,
  error,
  fallbackLabel,
  onClose,
  onOpenMsProgress,
}: {
  data: MemberPayoutBreakdown | null;
  loading: boolean;
  error: string | null;
  fallbackLabel: string;
  onClose: () => void;
  onOpenMsProgress: () => void;
}) {
  const title = data ? `${data.memberName} / ${data.projectName} / ${fmtYm(data.ym)} 稼働分` : fallbackLabel;
  const breakdownTotal = data?.breakdown.reduce((sum, row) => sum + row.payYen, 0) ?? 0;
  const pastMonths = data?.months.filter((month) => !month.isTargetMonth) ?? [];
  const carrySourceMonths = pastMonths.filter((month) => month.remainingFromThisMonthYen > 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-[min(1000px,96vw)] overflow-y-auto rounded-lg border border-border bg-background shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-background px-4 py-3">
          <div>
            <div className="text-[13px] font-semibold">{title}</div>
            <div className="text-[11px] text-muted-foreground">支払額の内訳</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenMsProgress}
              className="rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-muted/40"
            >
              MSの進捗を見る
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-muted/40"
            >
              閉じる
            </button>
          </div>
        </div>

        <div className="space-y-5 px-4 py-4 text-[12px]">
          {loading && <div className="py-10 text-center text-muted-foreground">内訳を読み込み中...</div>}
          {!loading && error && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">{error}</div>
          )}

          {!loading && data && (
            <>
              <section className="space-y-2">
                <h3 className="text-[12px] font-semibold">この月のお金の流れ</h3>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
                  <FlowBox label="当月発生" value={fmtYen(data.current.basePay)} note="今月進んだMSの分" />
                  <FlowSign sign="＋" />
                  <FlowBox
                    label="前月までの未払い残"
                    value={fmtYen(data.current.carryInYen)}
                    note={
                      carrySourceMonths.length > 0
                        ? `${carrySourceMonths.map((month) => fmtYm(month.ym)).join(" / ")} の未払い分`
                        : "前月までの未払いなし"
                    }
                  />
                  <FlowSign sign="＝" />
                  <FlowBox label="支払対象" value={fmtYen(data.current.grossDueYen)} note="今月払うべき上限額" />
                  <FlowSign sign="→" />
                  <FlowBox
                    label="当月支払"
                    value={fmtYen(data.current.paidYen)}
                    note={data.current.payoutExcluded ? "支払通知の対象外メンバー" : "実際に支払う額 (税抜)"}
                    tone="pay"
                  />
                  <FlowSign sign="→" />
                  <FlowBox label="月末未払い残" value={fmtYen(data.current.stockYen)} note="翌月へ繰越" tone="stock" />
                </div>
                {data.current.payoutExcluded && (
                  <p className="text-[11px] text-muted-foreground">
                    このメンバーは支払通知書の対象外で、割り当てられた {fmtYen(data.current.companyReserveYen)} は現金支払ではなく会社側の配賦として扱っている。
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-[12px] font-semibold">
                  当月発生 {fmtYen(data.current.basePay)} の中身
                </h3>
                {data.breakdown.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    この月に進んだMSがないため、当月の発生はない (繰越だけの月)。
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[720px] text-[11px]">
                      <thead className="border-b border-border bg-muted/40">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">MS (この月に進んだ分)</th>
                          <th className="px-2 py-1.5 text-right font-medium">MSの当月進み</th>
                          <th className="px-2 py-1.5 text-right font-medium">担当割合</th>
                          <th className="px-2 py-1.5 text-right font-medium">本人のpt</th>
                          <th className="px-2 py-1.5 text-right font-medium">1ptあたり</th>
                          <th className="px-2 py-1.5 text-right font-medium">金額</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.breakdown.map((row) => (
                          <tr key={`${row.msKey}:${row.pool}`}>
                            <td className="px-2 py-1.5">
                              <div className="font-medium">{row.title}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {row.msKey}
                                {row.pool === "cap_extra" ? " / 別財布" : ""}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right">{fmtPt(row.msConsumedPt)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtPct(row.share)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtPt(row.earnedPt)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtYen(row.ptUnit)}</td>
                            <td className="px-2 py-1.5 text-right font-medium">{fmtYen(row.payYen)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-border bg-muted/20">
                        <tr>
                          <td className="px-2 py-1.5 font-medium" colSpan={3}>
                            合計
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium">{fmtPt(data.current.earnedPt)}</td>
                          <td className="px-2 py-1.5" />
                          <td className="px-2 py-1.5 text-right font-semibold">{fmtYen(breakdownTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  金額 = MSの当月進み × 担当割合 × 1ptあたりの単価。1ptあたり {fmtYen(data.ptUnit)} は
                  「(クライアント支払 − バッファ) × 65% ÷ シーズン総pt」で決まる、このPJの本契約単価。
                  {data.extraPtUnit != null && ` 別財布分の単価は ${fmtYen(data.extraPtUnit)}。`}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-[12px] font-semibold">当月いくらまで払えるか</h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  <MiniStat
                    label="当月の支払枠"
                    value={fmtYen(data.cap.effectiveRegularCapBudgetYen)}
                    note={`月次上限 ${fmtYen(data.cap.regularCapBudgetYen)} + 前月までの未使用枠 ${fmtYen(data.cap.regularCapCarryInYen)}`}
                  />
                  <MiniStat
                    label="PJ全体の支払対象"
                    value={fmtYen(data.cap.totalGrossDueYen)}
                    note="全メンバーの「当月発生 + 繰越」の合計"
                  />
                  <MiniStat
                    label="PJ全体の当月支払"
                    value={fmtYen(data.cap.projectTotalPaidYen)}
                    note="支払枠を各メンバーの支払対象で按分した結果"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {data.cap.effectiveRegularCapBudgetYen <= 0
                    ? "当月の支払枠が0円のため、発生分と繰越はそのまま未払い残へ回っている。"
                    : data.cap.totalGrossDueYen > data.cap.effectiveRegularCapBudgetYen
                      ? "支払対象が支払枠を超えているので、全メンバーの支払対象に比例して按分し、払いきれない分が未払い残になる。"
                      : "支払枠が支払対象を上回っているので、発生分と繰越を全額支払っている。"}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-[12px] font-semibold">
                  繰越 {fmtYen(data.current.carryInYen)} は、いつの分か
                </h3>
                {pastMonths.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {data.planCycle
                      ? `${fmtYm(data.planCycle.periodStartYm)} 開始のシーズンで、この月より前の未払いはない。`
                      : "この月より前の未払いはない。"}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[720px] text-[11px]">
                      <thead className="border-b border-border bg-muted/40">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">稼働月</th>
                          <th className="px-2 py-1.5 text-right font-medium">当月発生</th>
                          <th className="px-2 py-1.5 text-right font-medium">繰越入</th>
                          <th className="px-2 py-1.5 text-right font-medium">支払対象</th>
                          <th className="px-2 py-1.5 text-right font-medium">支払</th>
                          <th className="px-2 py-1.5 text-right font-medium">月末未払い残</th>
                          <th className="px-2 py-1.5 text-right font-medium">今回の繰越に残っている分</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.months.map((month) => (
                          <tr key={month.ym} className={month.isTargetMonth ? "bg-muted/30 font-medium" : ""}>
                            <td className="px-2 py-1.5 font-mono">
                              {fmtYm(month.ym)}
                              {month.isTargetMonth ? " (この月)" : ""}
                            </td>
                            <td className="px-2 py-1.5 text-right">{fmtYen(month.basePay)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtYen(month.carryInYen)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtYen(month.grossDueYen)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtYen(month.paidYen)}</td>
                            <td className="px-2 py-1.5 text-right">{fmtYen(month.stockYen)}</td>
                            <td className="px-2 py-1.5 text-right">
                              {month.isTargetMonth ? "—" : fmtYen(month.remainingFromThisMonthYen)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  支払は「古い稼働月の発生分から順に消えた」ものとして右端の列に割り戻している。実際の計算は
                  「当月発生 + 繰越」の合計に対して枠を按分するだけで、どの月の分を先に払ったかは持っていないため、
                  この列だけは表示上の並べ方。合計と月末残高は計算どおりの値。
                  {data.planCycle &&
                    ` 遡る範囲は ${fmtYm(data.planCycle.periodStartYm)}〜${fmtYm(data.planCycle.periodEndYm)} のシーズン内 (シーズンが変わると繰越の鎖は切れる)。`}
                </p>
                {data.carryUnexplainedYen !== 0 && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                    繰越 {fmtYen(data.current.carryInYen)} のうち {fmtYen(Math.abs(data.carryUnexplainedYen))} は、
                    過去月の保存済み計算が欠けていて発生月まで辿れない。報酬キャッシュ再計算を実行すると解消することが多い。
                  </p>
                )}
              </section>

              {data.cacheGeneratedAt && (
                <p className="text-[10px] text-muted-foreground">
                  表示している金額は保存済みの報酬計算 ({fmtDateTime(data.cacheGeneratedAt)} 時点) の値で、一覧の金額と同じ。
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FlowBox({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "default" | "pay" | "stock";
}) {
  const toneClass =
    tone === "pay"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "stock"
        ? "border-amber-200 bg-amber-50"
        : "border-border bg-muted/20";
  return (
    <div className={`rounded-md border px-3 py-2 sm:min-w-[150px] sm:flex-1 ${toneClass}`}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-[14px] font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{note}</div>
    </div>
  );
}

function FlowSign({ sign }: { sign: string }) {
  return <div className="grid place-items-center px-0.5 text-[13px] text-muted-foreground">{sign}</div>;
}

function MiniStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-[13px] font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{note}</div>
    </div>
  );
}
