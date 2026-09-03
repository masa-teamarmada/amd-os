"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, CircleAlert, ExternalLink, Landmark } from "lucide-react";
import {
  buildPaymentMatrix,
  fiscalWindowFor,
  freeeStatusLabel,
  PAYMENT_KINDS,
  type PaymentLedgerRow,
  type PaymentLedgerState,
  type PaymentLedgerSummary,
  type PaymentMatrixCellState,
  type PaymentSettlement,
} from "@/lib/finance/payment-ledger";
import { StatutoryObligationCatalog, type CatalogOccurrenceInput } from "@/components/admin/StatutoryObligationCatalog";
import type { OperatingFact } from "@/lib/admin-schedule/types";

export type AdminPaymentsData = {
  today: string;
  rows: PaymentLedgerRow[];
  summary: PaymentLedgerSummary;
  occurrences: CatalogOccurrenceInput[];
  facts: OperatingFact[];
  lastSyncedAt: string | null;
  errors: string[];
};

type StateFilter = "all" | "unsettled" | "upcoming" | "paid";

const STATE_LABELS: Record<PaymentLedgerState, string> = {
  paid: "納付済み",
  overdue: "期限超過",
  due_today: "今日が期限",
  due_soon: "近い期限",
  upcoming: "これから",
  needs_review: "要確認",
};

const STATE_STYLES: Record<PaymentLedgerState, string> = {
  paid: "bg-emerald-100 text-emerald-900",
  overdue: "bg-rose-100 text-rose-950",
  due_today: "bg-amber-200 text-amber-950",
  due_soon: "bg-amber-100 text-amber-950",
  upcoming: "bg-sky-100 text-sky-950",
  needs_review: "bg-amber-100 text-amber-950",
};

const SETTLEMENT_KIND_LABELS: Record<string, string> = {
  tax_office: "税務署あて",
  social_insurance: "年金機構あて",
  labor_insurance: "労働保険",
  local_tax: "地方税",
};

function yen(value: number | null | undefined): string {
  if (value == null) return "金額未取得";
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function dateLabel(row: PaymentLedgerRow): string {
  if (row.dueDatePrecision === "day" && row.dueDate) {
    const date = new Date(`${row.dueDate}T00:00:00Z`);
    return `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
  }
  if (row.expectedPaymentYm) return `${row.expectedPaymentYm.slice(0, 4)}年${Number(row.expectedPaymentYm.slice(4, 6))}月中`;
  return "期限未確定";
}

function candidateLabel(candidate: PaymentSettlement["candidates"][number]): string {
  const status = freeeStatusLabel(candidate.freeeStatus);
  const parts = [`${candidate.date} ${yen(candidate.amountYen)}`];
  if (candidate.description) parts.push(candidate.description);
  if (status) parts.push(status);
  return parts.join(" / ");
}

/** freeeの口座明細を探した結果を、未納か記録漏れかが分かる日本語にする。 */
function settlementText(row: PaymentLedgerRow, today: string): string | null {
  if (row.state === "paid") {
    const paid = row.paidAt ? row.paidAt.slice(0, 10) : null;
    return paid ? `freeeの出金と一致（${paid} ${yen(row.paidAmountYen ?? row.amountYen)}）` : "納付済みとして記録されている";
  }
  const search = row.settlement;
  if (!search) {
    return row.sourceKind === "mail_notice"
      ? "届いた通知書をもとに登録した行。口座の照合はしていない"
      : null;
  }
  // 照合の窓がまだ開いていない納付に「出金が無い」と書かない。払う時期が来ていないだけ。
  if (search.from > today) return null;
  const kind = SETTLEMENT_KIND_LABELS[search.kind] ?? "該当する";
  if (search.candidateCount === 0) return `${search.from}〜${search.to}に${kind}の出金は無い`;
  const listed = search.candidates.map(candidateLabel).join(" ／ ");
  if (search.exactAmountCandidateCount > 0) {
    return `${kind}の同額の出金がある（${listed}）。別の月の納付として使われているか、freeeで消込が済んでいない`;
  }
  return `${kind}の出金はあるが金額が合わない（${listed}）`;
}

function penaltyText(row: PaymentLedgerRow): string | null {
  if (row.penaltyNotices.length > 0) {
    return row.penaltyNotices
      .map((notice) => `通知書が届いている: ${notice.title} ${yen(notice.amountYen)}${notice.dueDate ? ` / ${notice.dueDate}まで` : ""}`)
      .join(" ／ ");
  }
  const estimate = row.penaltyEstimate;
  if (!estimate) return null;
  if (estimate.totalYen == null) return "加算税・延滞税は割合が未収録の期間にかかるため未算出";
  if (estimate.totalYen <= 0) return null;
  const breakdown: string[] = [];
  if ((estimate.underpaymentPenaltyYen ?? 0) > 0) breakdown.push(`不納付加算税 ${yen(estimate.underpaymentPenaltyYen)}`);
  if ((estimate.delinquencyYen ?? 0) > 0) {
    breakdown.push(`${estimate.delinquencyKind === "social_insurance" ? "延滞金" : "延滞税"} ${yen(estimate.delinquencyYen)}`);
  }
  return `このままだと ${yen(estimate.totalYen)}（${breakdown.join(" + ")}）`;
}

function matchesFilter(row: PaymentLedgerRow, filter: StateFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unsettled") return row.state === "overdue" || row.state === "needs_review";
  if (filter === "upcoming") return row.state === "due_today" || row.state === "due_soon" || row.state === "upcoming";
  return row.state === "paid";
}

function SummaryTile({ label, value, note, tone }: { label: string; value: string; note: string; tone: "danger" | "warn" | "ok" | "plain" }) {
  const toneClass = tone === "danger"
    ? "border-rose-300 bg-rose-50 text-rose-950"
    : tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-950"
      : tone === "ok"
        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
        : "border-border bg-card";
  return (
    <div className={`border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5">{note}</p>
    </div>
  );
}

const MATRIX_CELL_STYLES: Record<PaymentMatrixCellState, string> = {
  none: "text-muted-foreground/40",
  paid: "bg-emerald-50 text-emerald-900",
  attention: "bg-rose-100 text-rose-950 font-semibold",
  scheduled: "bg-sky-50 text-sky-950",
};

function compactYen(value: number): string {
  return value.toLocaleString("ja-JP");
}

function fiscalLabel(startYm: string, endYm: string): string {
  const s = `${startYm.slice(0, 4)}年${Number(startYm.slice(4, 6))}月`;
  const e = `${endYm.slice(0, 4)}年${Number(endYm.slice(4, 6))}月`;
  return `${s}〜${e}`;
}

/**
 * 月を行、税・保険料の種類を列にした一覧。
 * 期限順に並べた明細だけだと同じ名前が何十行も続き、どの税がいつ・いくら残っているかを掴めない。
 * 納付済みは緑、期限を過ぎている・要確認は赤、これから納めるものは青で塗り分け、
 * 最後に種類ごとの今期合計と、そのうち未納の額を置く。
 */
function PaymentMatrixSection({ rows, today, fiscalYearEndMonth }: { rows: PaymentLedgerRow[]; today: string; fiscalYearEndMonth: number }) {
  const [offset, setOffset] = useState(0);
  const fiscalRange = useMemo(() => {
    const base = fiscalWindowFor(today, fiscalYearEndMonth);
    if (offset === 0) return base;
    const shift = (ym: string) => `${Number(ym.slice(0, 4)) + offset}${ym.slice(4, 6)}`;
    return { startYm: shift(base.startYm), endYm: shift(base.endYm) };
  }, [fiscalYearEndMonth, offset, today]);
  const matrix = useMemo(
    () => buildPaymentMatrix(rows, today, fiscalYearEndMonth, fiscalRange),
    [fiscalRange, fiscalYearEndMonth, rows, today]
  );
  const currentYm = today.slice(0, 7).replace("-", "");
  return (
    <section aria-labelledby="payment-matrix-title" data-testid="payment-matrix" className="space-y-3 border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="payment-matrix-title" className="text-lg font-semibold">月ごと・種類ごとの納付</h2>
          <span className="text-sm text-muted-foreground">{fiscalLabel(matrix.startYm, matrix.endYm)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100" />納付済み
            <span className="inline-block h-3 w-3 rounded-sm bg-rose-200" />期限超過・要確認
            <span className="inline-block h-3 w-3 rounded-sm bg-sky-100" />これから
          </span>
          <button type="button" onClick={() => setOffset((value) => value - 1)} className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted">前の期</button>
          <button type="button" onClick={() => setOffset(0)} disabled={offset === 0} className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-40">今期</button>
          <button type="button" onClick={() => setOffset((value) => value + 1)} className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted">次の期</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="sticky left-0 bg-card py-2 pr-3 text-left font-semibold">月</th>
              {PAYMENT_KINDS.map((kind) => (
                <th key={kind.key} scope="col" className="px-2 py-2 text-right font-semibold">
                  {kind.label}
                  <span className="block text-[10px] font-normal text-muted-foreground/80">{kind.payee}</span>
                </th>
              ))}
              <th scope="col" className="px-2 py-2 text-right font-semibold">月合計</th>
            </tr>
          </thead>
          <tbody>
            {matrix.months.map((month) => (
              <tr key={month.ym} className={`border-b border-border/60 ${month.ym === currentYm ? "outline outline-1 outline-[#027FDC]/40" : ""}`}>
                <th scope="row" className="sticky left-0 bg-card py-1.5 pr-3 text-left font-medium">
                  {month.ym.slice(0, 4)}年{Number(month.ym.slice(4, 6))}月
                  {month.ym === currentYm && <span className="ml-1 text-[10px] font-semibold text-[#027FDC]">今月</span>}
                </th>
                {PAYMENT_KINDS.map((kind) => {
                  const cell = month.cells[kind.key];
                  return (
                    <td key={kind.key} className={`px-2 py-1.5 text-right ${MATRIX_CELL_STYLES[cell.state]}`}>
                      {cell.count === 0 ? "·" : (
                        <>
                          {compactYen(cell.totalYen)}
                          {cell.unknownAmountCount > 0 && <span className="ml-1 text-[10px]">額未取得{cell.unknownAmountCount}件</span>}
                        </>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-right font-medium">{month.totals.count === 0 ? "·" : compactYen(month.totals.totalYen)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/20 text-sm">
              <th scope="row" className="sticky left-0 bg-card py-2 pr-3 text-left font-semibold">今期合計</th>
              {PAYMENT_KINDS.map((kind) => (
                <td key={kind.key} className="px-2 py-2 text-right font-semibold">{compactYen(matrix.kindTotals[kind.key].totalYen)}</td>
              ))}
              <td className="px-2 py-2 text-right font-semibold">{compactYen(matrix.totals.totalYen)}</td>
            </tr>
            <tr className="text-sm">
              <th scope="row" className="sticky left-0 bg-card py-2 pr-3 text-left font-semibold text-rose-900">うち未納</th>
              {PAYMENT_KINDS.map((kind) => {
                const unpaid = matrix.kindTotals[kind.key].unpaidYen;
                return (
                  <td key={kind.key} className={`px-2 py-2 text-right ${unpaid > 0 ? "font-semibold text-rose-900" : "text-muted-foreground/50"}`}>
                    {unpaid > 0 ? compactYen(unpaid) : "·"}
                  </td>
                );
              })}
              <td className={`px-2 py-2 text-right font-semibold ${matrix.totals.unpaidYen > 0 ? "text-rose-900" : ""}`}>{compactYen(matrix.totals.unpaidYen)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        金額は納期限が属する月に置く。未納には期限がまだ来ていない分も含む。
        {matrix.outsideCount > 0 && ` この期の外に期限がある納付が${matrix.outsideCount}件あり、下の明細に並ぶ。`}
      </p>
    </section>
  );
}

export function AdminPaymentsClient({ data }: { data: AdminPaymentsData }) {
  // 決算月。取れないときは12月決算として扱う（AMDの現行）。
  const fiscalYearEndMonth = useMemo(() => {
    const fact = data.facts.find((row) => row.fact_key === "fiscal_year_end_month");
    const raw = (fact?.value_json as { value?: unknown } | null)?.value;
    const parsed = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : 12;
  }, [data.facts]);
  const [filter, setFilter] = useState<StateFilter>("all");
  const visible = useMemo(() => data.rows.filter((row) => matchesFilter(row, filter)), [data.rows, filter]);
  const { summary } = data;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">管理 / 会社運営</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">納付</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              税務署・都道府県・市町村・年金機構・労働局へ、いつ・いくら納めるかだけを期限順に並べる。納付済みかどうかは毎朝freeeの口座明細と突き合わせた結果を各行に書く。
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          <span>freeeの照合: 毎日 9:20 JST{data.lastSyncedAt ? ` / 最終取得 ${data.lastSyncedAt.slice(0, 16).replace("T", " ")}` : ""}</span>
          <Link href="/admin/schedule" className="inline-flex items-center gap-1 underline underline-offset-2">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />契約・報告も含む管理カレンダー
          </Link>
          <Link href="/admin/finance#payment-obligations" className="inline-flex items-center gap-1 underline underline-offset-2">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />金額・期日を直す（支払義務）
          </Link>
        </div>
      </header>

      {data.errors.length > 0 && (
        <div role="alert" className="flex gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div><p className="font-semibold">納付台帳の読み込みに失敗した項目がある</p><p className="mt-1 text-xs leading-5">{data.errors.join(" / ")}</p></div>
        </div>
      )}

      <section aria-label="納付の状態" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label="期限を過ぎている・要確認"
          value={yen(summary.overdueYen)}
          note={`${summary.overdueCount}件。納めるまで延滞税が日ごとに増える`}
          tone={summary.overdueCount > 0 ? "danger" : "plain"}
        />
        <SummaryTile
          label="これから納める"
          value={yen(summary.upcomingYen)}
          note={`${summary.upcomingCount}件。今日以降に期限が来る分`}
          tone="plain"
        />
        <SummaryTile
          label="加算税・延滞税"
          value={yen(summary.penaltyNoticeYen + summary.penaltyEstimateYen)}
          note={`通知書が届いた分 ${yen(summary.penaltyNoticeYen)} / 未納から積み上がる見込み ${yen(summary.penaltyEstimateYen)}`}
          tone={summary.penaltyNoticeYen + summary.penaltyEstimateYen > 0 ? "warn" : "plain"}
        />
        <SummaryTile
          label="納付済みとして消し込めた分"
          value={yen(summary.paidYen)}
          note={`${summary.paidCount}件。freeeの出金と金額・日付が一致したもの${summary.unknownAmountCount > 0 ? ` / 金額未取得が${summary.unknownAmountCount}件` : ""}`}
          tone="ok"
        />
      </section>

      <PaymentMatrixSection rows={data.rows} today={data.today} fiscalYearEndMonth={fiscalYearEndMonth} />

      <section className="flex flex-wrap items-center gap-2 border border-border bg-card p-3" aria-label="表示の絞り込み">
        <span className="px-1 text-xs font-semibold text-muted-foreground">絞り込み</span>
        {([
          ["all", "すべて"],
          ["unsettled", "期限超過・要確認"],
          ["upcoming", "これから"],
          ["paid", "納付済み"],
        ] as Array<[StateFilter, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`min-h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${filter === value ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-muted"}`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto px-1 text-xs text-muted-foreground">{visible.length}件</span>
      </section>

      <section aria-labelledby="payment-ledger-title" data-testid="payment-ledger" className="space-y-3 border border-border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="payment-ledger-title" className="text-lg font-semibold">納付の予定と実績</h2>
          <p className="text-sm text-muted-foreground">
            期限の近い順。金額・期日・納付済みの正本は支払義務台帳で、この画面からは直せない。
            {summary.unreviewedMailCandidateCount > 0 && `メール由来で人の確認が付いていない候補${summary.unreviewedMailCandidateCount}件はここに数えていない。`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-semibold">期限</th>
                <th scope="col" className="py-2 pr-3 font-semibold">納めるもの</th>
                <th scope="col" className="py-2 pr-3 font-semibold">納付先</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">金額</th>
                <th scope="col" className="py-2 pr-3 font-semibold">状態</th>
                <th scope="col" className="py-2 font-semibold">freeeで調べた結果</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const penalty = penaltyText(row);
                const settlement = settlementText(row, data.today);
                return (
                  <tr key={row.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                      {dateLabel(row)}
                      {row.overdueDays != null && <span className="ml-1 text-xs font-semibold text-rose-700">{row.overdueDays}日超過</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{row.title}</span>
                      {row.isPenalty && <span className="ml-1 rounded bg-rose-100 px-1 py-0.5 text-xs font-semibold text-rose-950">罰金</span>}
                      {row.sourceRef && row.sourceKind === "mail_notice" && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{row.sourceRef}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">{row.counterparty ?? "未取得"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                      {yen(row.amountYen)}
                      {row.amountStatus === "estimated" && <span className="ml-1 text-xs text-muted-foreground">概算</span>}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${STATE_STYLES[row.state]}`}>{STATE_LABELS[row.state]}</span>
                    </td>
                    <td className="py-2 text-xs leading-5">
                      {settlement && <span>{settlement}</span>}
                      {penalty && <span className="mt-0.5 block font-semibold">{penalty}</span>}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">この絞り込みに当てはまる納付はないよ。</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          {summary.overdueCount > 0
            ? <><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-700" aria-hidden="true" />期限を過ぎた分は、まさときよのSlackへ督促が届く（1日後・3日後・7日後・14日後、それ以降は週1回）。</>
            : <><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />期限を過ぎた納付はない。</>}
        </p>
      </section>

      <StatutoryObligationCatalog occurrences={data.occurrences} facts={data.facts} today={data.today} />
    </div>
  );
}
