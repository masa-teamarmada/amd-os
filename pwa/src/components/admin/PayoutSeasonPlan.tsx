"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { SEASON_METRICS, type PayoutSeasonPlan as Plan, type SeasonCell, type SeasonMetric, type SeasonProjectPlan, type SeasonMemberPayment, type SeasonPaymentCell } from "@/lib/payout-season-plan";

const number = new Intl.NumberFormat("ja-JP");
function ymLabel(ym: string) { return `${ym.slice(0, 4)}/${ym.slice(4)}`; }
function valueLabel(value: number | null) { return value == null ? "未計算" : value === 0 ? "—" : number.format(value); }
const metrics = SEASON_METRICS;
type MatrixRow = { key: string; metric: SeasonMetric; label: string; combinePay?: boolean; member?: SeasonMemberPayment };
function paymentTotal(cell: SeasonPaymentCell) {
  return cell.regularPay == null || cell.extraPay == null ? null : cell.regularPay + cell.extraPay;
}
function paymentBreakdown(cell: SeasonPaymentCell) {
  const yen = (value: number | null) => value == null ? "未計算" : `${number.format(value)}円`;
  return `本契約 ${yen(cell.regularPay)} · 別財布 ${yen(cell.extraPay)}`;
}

export function PayoutSeasonPlan({ ym, refreshToken, onOpenMonthly }: {
  ym: string; refreshToken: unknown;
  onOpenMonthly: (projectId: string, sourceYm: string, label: string) => void;
}) {
  type Result = { plan: (Plan & { unallocatedExpenses?: number }) | null; error: string | null; ym: string; refreshToken: unknown; retry: number };
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/payouts/season-plan?ym=${encodeURIComponent(ym)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || "収支予定を取得できませんでした"); return payload; })
      .then((payload) => { if (!controller.signal.aborted) setResult({ plan: payload, error: null, ym, refreshToken, retry }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setResult({ plan: null, error: error instanceof Error ? error.message : "収支予定を取得できませんでした", ym, refreshToken, retry }); });
    return () => controller.abort();
  }, [ym, refreshToken, retry]);
  const loading = !result || result.ym !== ym || result.refreshToken !== refreshToken || result.retry !== retry;
  return <PayoutSeasonPlanView ym={ym} plan={result?.ym === ym ? result.plan : null} loading={loading} error={loading ? null : result?.error ?? null} onReload={() => setRetry(retry + 1)} onOpenMonthly={onOpenMonthly} />;

}

export function PayoutSeasonPlanView({ ym, plan: current, loading = false, error = null, onReload = () => {}, onOpenMonthly }: {
  ym: string; plan: (Plan & { unallocatedExpenses?: number }) | null;
  loading?: boolean; error?: string | null; onReload?: () => void;
  onOpenMonthly: (projectId: string, sourceYm: string, label: string) => void;
}) {
  const [full, setFull] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrapper = scrollRef.current;
    const column = wrapper?.querySelector<HTMLElement>(`[data-payment-column="${ym}"]`);
    if (wrapper && column) wrapper.scrollTo({ left: Math.max(0, column.offsetLeft - 360), behavior: "instant" });
  }, [current?.paymentYm, ym]);
  const shown: MatrixRow[] = metrics.filter(([key]) => key !== "extraPay" && (full || ["net", "regularPay", "debt"].includes(key))).map(([metric, label]) => ({ key: metric, metric, label: metric === "regularPay" ? "報酬支払計" : label, combinePay: metric === "regularPay" }));
  const aggregateRows = shown.filter(({ metric }) => ["income", "regularPay", "net", "debt"].includes(metric));
  function projectRows(project: SeasonProjectPlan): MatrixRow[] {
    return shown.flatMap((row) => row.metric !== "regularPay" ? [row] : project.memberPayments.length ? project.memberPayments.map((member) => ({ ...row, key: `member:${member.memberId}`, label: `報酬 · ${member.memberName}`, member })) : [{ ...row, label: project.missingMonths.length ? "報酬 · メンバー未計算" : "報酬 · 対象者なし" }]);
  }
  function rowTotal(project: SeasonProjectPlan, row: MatrixRow) {
    return row.member ? paymentTotal(row.member.totals) : row.combinePay ? paymentTotal(project.totals) : project.totals[row.metric];
  }
  const pending = current?.projects.filter((row) => !row.planId || SEASON_METRICS.some(([metric]) => row.totals[metric] == null)).length ?? 0;
  const styles = (value: number | null, metric: SeasonMetric) => value == null ? "text-muted-foreground" : value < 0 && (metric === "net" || metric === "cumulative") ? "text-red-700 font-semibold" : metric === "debt" && value > 0 ? "text-amber-800" : "text-foreground";
  const rewardTotal = (project: SeasonProjectPlan, future: boolean) => {
    const values = current!.months.filter((month) => future ? month > ym : month === ym).flatMap((month) => [project.cells[month].regularPay, project.cells[month].extraPay]);
    return values.some((value) => value == null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);
  };
  function jumpToPayment() {
    const wrapper = scrollRef.current;
    const column = wrapper?.querySelector<HTMLElement>(`[data-payment-column="${ym}"]`);
    if (wrapper && column) wrapper.scrollTo({ left: Math.max(0, column.offsetLeft - 360), behavior: "instant" });
  }
  function numericCells(cells: Record<string, SeasonCell>, row: MatrixRow, project?: SeasonProjectPlan) {
    const { metric } = row;
    return current!.months.map((month) => {
      const payment = row.member?.cells[month] ?? cells[month];
      const value = row.combinePay ? paymentTotal(payment) : cells[month][metric];
      const outsideDebt = metric === "debt" && project?.startYm != null && (month < project.startYm || month > project.endYm!);
      const label = outsideDebt ? "対象期間外" : value == null ? "報酬計算または支出額が未確認" : `${number.format(value)}円`;
      const classes = `border-b border-r border-border/60 px-2 py-1 text-right font-mono tabular-nums ${styles(value, metric)} ${month === ym ? "bg-sky-50 dark:bg-sky-950/40" : ""}`;
      return <td key={month} data-payout-month={month} className={classes} title={`${project?.projectName ?? "全PJ合計"} / ${row.label} / ${ymLabel(month)} / ${label}${row.combinePay ? `（${paymentBreakdown(payment)}）` : ""}`}>
        {project && metric === "debt" && !outsideDebt ? <button type="button" className="w-full text-right underline decoration-border underline-offset-2 hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-sky-600" onClick={() => onOpenMonthly(project.projectId, month, `${project.projectName} ${ymLabel(month)}`)} aria-label={`${project.projectName} ${ymLabel(month)}の報酬根拠を見る`}>{valueLabel(value)}</button> : outsideDebt ? "·" : valueLabel(value)}
      </td>;
    });
  }
  return <section id="payout-season-plan" aria-labelledby="payout-season-plan-title" className="min-w-0 space-y-2">
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id="payout-season-plan-title" className="text-sm font-semibold">01 全PJのシーズン収支予定</h2>
      {current && <span className="text-xs text-muted-foreground">{current.projects.length} PJ · {ymLabel(current.months[0])}〜{ymLabel(current.months.at(-1)!)} · 円</span>}
      <div className="ml-auto flex items-center gap-1 text-xs">
        <button type="button" onClick={() => setFull(!full)} aria-pressed={full} className="h-7 border border-border px-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-sky-600">{full ? "報酬中心にする" : "収支明細も表示"}</button>
        <button type="button" onClick={jumpToPayment} className="h-7 border border-border px-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-sky-600">支払月へ</button>
        <Link href="/admin/season-pl" className="px-2 text-sky-700 underline underline-offset-2">シーズン予実</Link>
      </div>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span>売上・報酬は税抜、立替は実費。青い列は今回の支払月。未払報酬は稼働月末の残高。</span>
      <span>報酬はメンバー別。本契約＋別財布を表示し、金額にマウスを乗せると内訳を確認できる。</span>
      <span>差引＝入金予定−報酬支払−立替−登録済み追加支出。</span>
    </div>
    <div aria-live="polite" className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
      {loading && <span className="text-muted-foreground">収支予定を読込中…</span>}
      {current && <><span>{current.projects.filter((row) => row.planId).length} PJにシーズン設定</span><span className={pending ? "text-amber-800" : "text-muted-foreground"}>未設定・未計算 {pending} PJ</span><span>設定済みPJの期末未払報酬 {current.totals.debt == null ? "未計算" : `${number.format(current.totals.debt)}円`}</span></>}
    </div>
    {error ? <div role="alert" className="border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">{error}<button type="button" onClick={onReload} className="ml-3 underline">収支予定を再読込</button></div> : current ? <>
      <div ref={scrollRef} role="region" aria-label="全PJのシーズン月別収支表" tabIndex={0} className="max-h-[560px] overflow-auto border border-border focus-visible:outline-2 focus-visible:outline-sky-600">
        <table data-amie-list="matrix" data-testid="payout-season-matrix" className="w-max min-w-full table-fixed border-separate border-spacing-0 text-[11px] leading-4">
          <colgroup><col style={{ width: 104 }} /><col style={{ width: 144 }} /><col style={{ width: 104 }} />{current.months.map((month) => <col key={month} style={{ width: 88 }} />)}</colgroup>
          <thead><tr>
            <th scope="col" className="sticky left-0 top-0 z-40 border-b border-r border-border bg-muted px-2 py-2 text-left">PJ・シーズン</th>
            <th scope="col" className="sticky left-[104px] top-0 z-40 border-b border-r border-border bg-muted px-2 py-2 text-left">費目・メンバー</th>
            <th scope="col" className="sticky left-[248px] top-0 z-40 border-b border-r border-border bg-muted px-2 py-2 text-right">計／期末残</th>
            {current.months.map((month) => <th key={month} data-payment-column={month} scope="col" aria-current={month === ym ? "date" : undefined} className={`sticky top-0 z-30 border-b border-r border-border px-2 py-2 text-right font-mono ${month === ym ? "bg-sky-100 font-bold text-sky-950 dark:bg-sky-900 dark:text-sky-50" : "bg-muted"}`}>{ymLabel(month)}</th>)}
          </tr></thead>
          <tbody>
            {aggregateRows.map((row, index) => {
              const { metric, label } = row;
              const total = row.combinePay ? paymentTotal(current.totals) : current.totals[metric];
              return <tr key={`all:${metric}`} className="bg-muted/30 font-semibold">
              {index === 0 && <th rowSpan={aggregateRows.length} scope="rowgroup" className="sticky left-0 z-20 border-b border-r border-border bg-muted px-2 py-1 text-left align-top">設定済みPJ計</th>}
              <th scope="row" className="sticky left-[104px] z-20 border-b border-r border-border bg-muted px-2 py-1 text-left">{label}</th>
              <td className={`sticky left-[248px] z-20 border-b border-r border-border bg-muted px-2 py-1 text-right font-mono ${styles(total, metric)}`} title={metric === "debt" ? "各PJのシーズン末残高の合計" : row.combinePay ? paymentBreakdown(current.totals) : "選択した各PJのシーズン合計"}>{valueLabel(total)}</td>
              {numericCells(current.totalCells, row)}
            </tr>; })}
            {current.projects.map((project) => !project.planId ? <tr key={project.projectId}>
              <th scope="row" className="sticky left-0 z-20 border-b border-r border-border bg-background px-2 py-1 text-left">{project.projectName}</th>
              <td colSpan={current.months.length + 2} className="border-b border-border px-2 py-1 text-muted-foreground">シーズン未設定 · <Link href={`/project/${project.projectId}/cockpit`} className="text-sky-700 underline">PJで条件を確認</Link></td>
            </tr> : <Fragment key={project.projectId}>{projectRows(project).map((row, index, rows) => {
              const { metric, label } = row;
              const total = rowTotal(project, row);
              return <tr key={row.key} data-payout-project={project.projectId} data-payout-member={row.member?.memberId} className={metric === "net" ? "bg-muted/20 font-medium" : "hover:bg-muted/20"}>
              {index === 0 && <th rowSpan={rows.length} scope="rowgroup" className="sticky left-0 z-20 border-b border-r border-border bg-background px-2 py-1 text-left align-top">
                <Link href={`/project/${project.projectId}/cockpit`} className="font-semibold text-sky-800 hover:underline">{project.projectName}</Link>
                <div className="mt-1 font-mono text-[10px] font-normal text-muted-foreground">{ymLabel(project.startYm!)}<br />〜{ymLabel(project.endYm!)}</div>
                {full && <div className="mt-2 text-[10px] font-normal text-muted-foreground">今回報酬<div className="font-mono text-foreground">{valueLabel(rewardTotal(project, false))}</div>今後報酬<div className="font-mono text-foreground">{valueLabel(rewardTotal(project, true))}</div></div>}
                {project.missingMonths.length > 0 && <div className="mt-1 font-normal text-amber-800" title={project.missingMonths.map(ymLabel).join("、")}>未計算 {project.missingMonths.length}月</div>}
                {project.notes.map((note) => <div key={note} className="mt-1 text-[10px] font-normal text-muted-foreground">{note}</div>)}
              </th>}
              <th scope="row" title={row.member ? `${row.member.memberName} / ${row.member.memberId}` : label} className={`sticky left-[104px] z-20 border-b border-r border-border px-2 py-1 text-left font-normal ${metric === "net" ? "bg-muted font-semibold" : "bg-background"}`}><span className="block max-w-[128px] truncate">{label}</span></th>
              <td title={row.combinePay ? paymentBreakdown(row.member?.totals ?? project.totals) : metric === "debt" || metric === "cumulative" ? `${ymLabel(project.endYm!)}末の残高` : "対象シーズンの合計"} className={`sticky left-[248px] z-20 border-b border-r border-border bg-muted px-2 py-1 text-right font-mono font-medium ${styles(total, metric)}`}>{valueLabel(total)}</td>
              {numericCells(project.cells, row, project)}
            </tr>; })}</Fragment>)}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">「—」は0円、「未計算」は金額未確認。未計算を含む合計も未計算と表示。未払報酬は期末残高を表示し、月ごとの残高を足さない。会社共通費・期首資金は財務で確認。</p>
    </> : <div className="h-[560px] border border-border bg-muted/20 p-3 text-xs text-muted-foreground">全PJのシーズン開始から最終支払月までを読み込んでいます…</div>}
  </section>;
}
