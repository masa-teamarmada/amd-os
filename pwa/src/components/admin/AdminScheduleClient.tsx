"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileText,
  Landmark,
  ReceiptText,
  RefreshCcw,
  SlidersHorizontal,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { buildMonthGrid, CALENDAR_WEEKDAYS, isDatePrecisionDay, rollingCalendarMonths } from "@/lib/admin-schedule/calendar";
import { rollingScheduleWindow, todayJst } from "@/lib/admin-schedule/date";
import {
  counterpartyFor,
  formatScheduleYen,
  isAnnualStatutoryPayment,
  nextPayment,
  paymentMonthKey,
  paymentStatusLabel,
  paymentTimingSummary,
} from "@/lib/admin-schedule/operations";
import type { PaymentTimingSummary } from "@/lib/admin-schedule/operations";
import {
  resolveObligationCatalog,
  type ObligationCoverage,
} from "@/lib/admin-schedule/rules/statutory-obligation-catalog";
import type {
  AmountRole,
  ScheduleCategory,
  ScheduleViewData,
  ScheduleViewOccurrence,
} from "@/lib/admin-schedule/types";

type Props = { initialData: ScheduleViewData };
type StatusFilter = "all" | ScheduleViewOccurrence["computed_status"];
type CalendarMonth = { year: number; month: number; key: string };
type ViewMode = "operations" | "calendar";

const CATEGORY_LABELS: Record<ScheduleCategory, string> = {
  tax: "税務",
  labor: "労務",
  contract: "契約",
  report: "報告",
  invoice: "請求",
  receipt: "入金",
  payment: "支払",
  governance: "経営",
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "すべて",
  overdue: "期限超過",
  due_today: "今日",
  due_soon: "近い期限",
  open: "未完了",
  completed: "完了",
  cancelled: "取消",
  needs_source: "根拠不足",
};

const STATUS_STYLES: Record<ScheduleViewOccurrence["computed_status"], string> = {
  overdue: "border-l-rose-600 bg-rose-50 text-rose-950",
  due_today: "border-l-amber-600 bg-amber-50 text-amber-950",
  due_soon: "border-l-amber-400 bg-amber-50/70 text-amber-950",
  open: "border-l-sky-500 bg-sky-50 text-sky-950",
  completed: "border-l-emerald-500 bg-emerald-50 text-emerald-950",
  cancelled: "border-l-slate-400 bg-muted text-muted-foreground",
  needs_source: "border-l-amber-700 bg-amber-50 text-amber-950",
};

const CATEGORY_ICONS: Record<ScheduleCategory, typeof CalendarDays> = {
  tax: Landmark,
  labor: UserRound,
  contract: FileText,
  report: FileText,
  invoice: ReceiptText,
  receipt: WalletCards,
  payment: WalletCards,
  governance: CalendarDays,
};

type PenaltyEstimate = {
  parentSourceKey?: string;
  overdueDays?: number;
  delinquencyKind?: string;
  delinquencyYen?: number | null;
  underpaymentPenaltyYen?: number | null;
  totalYen?: number | null;
  ratesAsOf?: string;
  formula?: string;
};

type SettlementSearch = {
  kind?: string;
  from?: string;
  to?: string;
  matched?: boolean;
  candidateCount?: number;
  exactAmountCandidateCount?: number;
  candidates?: Array<{ date?: string; amountYen?: number }>;
};

const SETTLEMENT_KIND_LABELS: Record<string, string> = {
  tax_office: "税務署あて",
  social_insurance: "年金機構あて",
  labor_insurance: "労働保険",
  local_tax: "地方税",
};

function settlementSearchOf(item: ScheduleViewOccurrence): SettlementSearch | null {
  const value = item.metadata_json?.settlementSearch;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as SettlementSearch;
}

/** 口座を探した結果を日本語1文にする。未納なのか、金額違いで消し込めていないだけなのかを分ける。 */
function settlementSearchLabel(search: SettlementSearch): string | null {
  if (search.matched) return null;
  const kind = SETTLEMENT_KIND_LABELS[String(search.kind ?? "")] ?? "該当する";
  const count = search.candidateCount ?? 0;
  if (count === 0) return `${search.from}〜${search.to}に${kind}の出金は見つかっていない`;
  const listed = (search.candidates ?? [])
    .map((row) => `${row.date}に${formatScheduleYen(row.amountYen ?? 0)}`)
    .join("、");
  if ((search.exactAmountCandidateCount ?? 0) > 0) {
    return `${kind}の同額の出金がある（${listed}）。別の月の納付として使われているか、口座で消込が済んでいない`;
  }
  return `${kind}の出金は${count}件あるが金額が合わない（${listed}）`;
}

function penaltyEstimateOf(item: ScheduleViewOccurrence): PenaltyEstimate | null {
  const value = item.metadata_json?.penaltyEstimate;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as PenaltyEstimate;
}

function isStatutoryPaymentOccurrence(item: ScheduleViewOccurrence): boolean {
  return item.notification_owner === "payment_obligation"
    && item.amount_role === "outgoing"
    && (item.category === "tax" || item.category === "labor");
}

function overdueDaysOf(item: ScheduleViewOccurrence, today: string): number | null {
  if (!item.due_on) return null;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${item.due_on}T00:00:00Z`)) / 86400000);
}

/**
 * 納期限を過ぎたまま納付を確認できていない法定納付を、カレンダーの先頭で名指しする。
 * 過去の月へ遡らないと気づけない状態だと、加算税と延滞税が積み上がってから郵送で届く。
 */
function OverdueStatutoryAlert({ items, today }: { items: ScheduleViewOccurrence[]; today: string }) {
  const overdue = items
    .filter((item) => isStatutoryPaymentOccurrence(item) && item.computed_status === "overdue")
    .sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));
  if (overdue.length === 0) return null;
  // 届いた賦課決定通知を、元の未納の隣に置く。見込みより実額のほうが強い根拠になる。
  const noticesByParent = new Map<string, ScheduleViewOccurrence[]>();
  for (const item of items) {
    const parent = item.metadata_json?.penaltyForSourceKey;
    if (typeof parent !== "string" || !parent) continue;
    noticesByParent.set(parent, [...(noticesByParent.get(parent) ?? []), item]);
  }
  const principalYen = overdue.reduce((sum, item) => sum + (item.amount_yen ?? 0), 0);
  const penaltyYen = overdue.reduce((sum, item) => sum + (penaltyEstimateOf(item)?.totalYen ?? 0), 0);
  const unknownAmountCount = overdue.filter((item) => item.amount_status === "unknown").length;
  return (
    <section role="alert" data-testid="overdue-statutory-alert" className="border border-rose-300 bg-rose-50 p-4 text-rose-950">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden="true" />納期限を過ぎたまま納付を確認できていない</span>
        <span className="text-sm tabular-nums">{overdue.length}件 / 本税・保険料 {formatScheduleYen(principalYen)}</span>
        {penaltyYen > 0 && <span className="text-sm font-semibold tabular-nums">加算税・延滞税の見込み {formatScheduleYen(penaltyYen)}</span>}
      </div>
      <p className="mt-1 text-xs leading-5">
        納めるまで延滞税は日ごとに増える。実額は税務署・年金機構の通知書で確定するので、届いた通知は
        <Link href="/admin/finance#payment-obligations" className="mx-1 underline underline-offset-2">支払義務</Link>
        へ登録すると、この見込みに代わって期日つきで並ぶ。
        {unknownAmountCount > 0 && ` 金額を取得できていない行が${unknownAmountCount}件ある。`}
      </p>
      <ul className="mt-3 divide-y divide-rose-200 border-t border-rose-200">
        {overdue.map((item) => {
          const penalty = penaltyEstimateOf(item);
          const days = penalty?.overdueDays ?? overdueDaysOf(item, today);
          const sourceKey = item.metadata_json?.obligationSourceKey;
          const notices = typeof sourceKey === "string" ? noticesByParent.get(sourceKey) ?? [] : [];
          return (
            <li key={item.occurrence_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-sm">
              <span className="font-semibold">{item.title}</span>
              <span className="text-xs">{dateLabel(item)}{days != null && ` · ${days}日超過`}</span>
              <span className="tabular-nums">{formatScheduleYen(item.amount_yen)}</span>
              {notices.map((notice) => (
                <span key={notice.occurrence_id} className="text-xs tabular-nums">
                  通知書が届いている: {notice.title} {formatScheduleYen(notice.amount_yen)} / {dateLabel(notice)}まで
                </span>
              ))}
              {(() => {
                const search = settlementSearchOf(item);
                const label = search ? settlementSearchLabel(search) : null;
                return label ? <span className="text-xs">{label}</span> : null;
              })()}
              {penalty && (penalty.totalYen ?? 0) > 0 ? (
                <span className="text-xs tabular-nums">
                  見込み {formatScheduleYen(penalty.totalYen ?? 0)}
                  （{(penalty.underpaymentPenaltyYen ?? 0) > 0 ? `不納付加算税 ${formatScheduleYen(penalty.underpaymentPenaltyYen ?? 0)} + ` : ""}
                  {penalty.delinquencyKind === "social_insurance" ? "延滞金" : "延滞税"} {formatScheduleYen(penalty.delinquencyYen ?? 0)}）
                </span>
              ) : penalty && penalty.totalYen == null ? (
                <span className="text-xs">加算税・延滞税は割合が未収録の期間にかかるため未算出</span>
              ) : null}
              <Link href="/admin/finance#payment-obligations" className="ml-auto text-xs underline underline-offset-2">支払義務で確認</Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const CATALOG_COVERAGE_LABELS: Record<ObligationCoverage, string> = {
  generated: "カレンダーに出ている",
  needs_fact: "会社の情報が足りない",
  not_applicable: "該当しない",
  not_implemented: "仕組みがまだ無い",
};

const CATALOG_COVERAGE_STYLES: Record<ObligationCoverage, string> = {
  generated: "bg-emerald-100 text-emerald-900",
  needs_fact: "bg-amber-100 text-amber-950",
  not_applicable: "bg-muted text-muted-foreground",
  not_implemented: "bg-rose-100 text-rose-950",
};

const FACT_LABELS: Record<string, string> = {
  fiscal_year_end_month: "決算月",
  previous_corporate_tax_yen: "前期の法人税額",
  corporate_tax_interim_required: "法人税の中間申告が要るか",
  consumption_tax_filing_mode: "消費税の申告区分",
  withholding_payment_mode: "源泉所得税の納付方式",
  payroll_closing_day: "給与の締日",
  payroll_payment_day: "給与の支給日",
  year_end_adjustment_deadline_ymd: "年末調整の締切",
  social_insurance_enrollment: "社会保険の加入",
  labor_insurance_enrollment: "労働保険の加入",
  depreciable_assets_held: "償却資産を持っているか",
  real_estate_held: "土地・建物を持っているか",
  vehicles_held: "社用車を持っているか",
  resident_tax_special_collection_enrollment: "住民税を給与から天引きしているか",
  bonus_payments: "賞与を払うか",
  stamp_duty_taxable_documents: "印紙が要る契約書があるか",
};

function factLabel(key: string): string {
  return FACT_LABELS[key] ?? key;
}

/**
 * 会社が負う税・保険料・提出の全件。カレンダーに出ていないものも、出ていない理由とともに残す。
 * 生成できたものだけを並べると、仕組みの無い義務が画面から消えて誰も気づけない。
 */
function StatutoryObligationCatalogSection({ items, facts, today }: { items: ScheduleViewOccurrence[]; facts: ScheduleViewData["facts"]; today: string }) {
  const resolved = useMemo(() => {
    const knownFactKeys = new Set(
      facts
        .filter((fact) => !fact.superseded_at && (fact.value_json as { missing?: boolean } | null)?.missing !== true)
        .map((fact) => fact.fact_key)
    );
    return resolveObligationCatalog(
      items.map((item) => ({ event_kind: item.event_kind, title: item.title, due_on: item.due_on, lifecycle_status: item.lifecycle_status })),
      knownFactKeys,
      today
    );
  }, [facts, items, today]);
  const gaps = resolved.filter((entry) => entry.coverage !== "generated" && entry.coverage !== "not_applicable");
  return (
    <section aria-labelledby="obligation-catalog-title" data-testid="statutory-obligation-catalog" className="space-y-3 border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="obligation-catalog-title" className="text-lg font-semibold">会社が負う税・保険料・提出の全件</h2>
        <p className="text-sm text-muted-foreground">
          {resolved.length}件のうち{gaps.length}件はまだカレンダーに出せていない。出せない理由と、埋めるのに要る情報を各行に書いた。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-semibold">名前</th>
              <th scope="col" className="py-2 pr-3 font-semibold">納付先・提出先</th>
              <th scope="col" className="py-2 pr-3 font-semibold">いつ</th>
              <th scope="col" className="py-2 pr-3 font-semibold">いまの状態</th>
              <th scope="col" className="py-2 font-semibold">補足</th>
            </tr>
          </thead>
          <tbody>
            {resolved.map((entry) => (
              <tr key={entry.key} className="border-b border-border/60 align-top">
                <td className="py-2 pr-3">
                  <a href={entry.officialUrl} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2 hover:no-underline">{entry.title}</a>
                  <span className="ml-1 text-xs text-muted-foreground">{entry.kind === "filing" ? "提出" : "納付"}</span>
                </td>
                <td className="py-2 pr-3 text-xs">{entry.payee}</td>
                <td className="py-2 pr-3 text-xs">{entry.cadence}</td>
                <td className="py-2 pr-3">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${CATALOG_COVERAGE_STYLES[entry.coverage]}`}>{CATALOG_COVERAGE_LABELS[entry.coverage]}</span>
                  {entry.coverage === "generated" && (
                    <span className="ml-1 text-xs text-muted-foreground tabular-nums">{entry.occurrenceCount}件{entry.nextDueOn && ` / 次は${entry.nextDueOn}`}</span>
                  )}
                </td>
                <td className="py-2 text-xs leading-5">
                  {entry.missingFacts.length > 0 && (
                    <span className="mr-1 font-semibold">足りない情報: {entry.missingFacts.map(factLabel).join("、")}。</span>
                  )}
                  {entry.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function monthKey(year: number, month: number): string {
  return `${year}${String(month).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

function dateLabel(item: ScheduleViewOccurrence): string {
  if (item.date_precision === "day" && item.due_on) {
    const date = new Date(`${item.due_on}T00:00:00Z`);
    return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
  }
  if (item.date_precision === "month" && item.due_ym) return `${item.due_ym.slice(0, 4)}年${Number(item.due_ym.slice(4, 6))}月（日期未確定）`;
  if (item.date_precision === "period" && item.period_key) return `${item.period_key}（日付未確定）`;
  if (item.due_ym) return `${item.due_ym.slice(0, 4)}年${Number(item.due_ym.slice(4, 6))}月（期限未確定）`;
  return "期限未確定";
}

function fullDateLabel(item: ScheduleViewOccurrence): string {
  if (item.date_precision === "day" && item.due_on) return `${item.due_on}（${item.date_kind}）`;
  return `${dateLabel(item)} / ${item.date_kind}`;
}

function amountRoleLabel(role: AmountRole): string {
  if (role === "outgoing") return "支出";
  if (role === "incoming") return "入金";
  if (role === "contract_reference") return "契約参照額";
  return "情報";
}

function amountLabel(item: ScheduleViewOccurrence): string {
  if (item.amount_status === "not_applicable") return "金額なし";
  if (item.amount_yen == null || item.amount_status === "unknown") return "金額未確定";
  const prefix = item.amount_status === "estimated" ? "概算 " : "";
  return `${prefix}¥${item.amount_yen.toLocaleString("ja-JP")} / ${amountRoleLabel(item.amount_role)}`;
}

function shortAmountLabel(item: ScheduleViewOccurrence): string | null {
  if (item.amount_yen == null || item.amount_status === "unknown" || item.amount_status === "not_applicable") return null;
  return `${item.amount_status === "estimated" ? "概算 " : ""}¥${item.amount_yen.toLocaleString("ja-JP")}`;
}

function itemMatchesMonthKey(item: ScheduleViewOccurrence): string | null {
  return item.due_on?.slice(0, 7).replace("-", "") ?? item.due_ym ?? item.period_key ?? null;
}

function itemMatchesMonth(item: ScheduleViewOccurrence, key: string): boolean {
  return itemMatchesMonthKey(item) === key;
}

function shortTitle(item: ScheduleViewOccurrence): string {
  return item.title.replace(/^.*?\s\/\s/, "");
}

function stateLabel(item: ScheduleViewOccurrence): string {
  if (item.missing_reason || item.computed_status === "needs_source") return "根拠不足";
  if (item.freshness_state === "source_stale") return "正本の鮮度要確認";
  if (item.freshness_state === "generation_stale") return "再生成待ち";
  if (item.freshness_state === "rule_stale") return "ルール再確認";
  return STATUS_LABELS[item.computed_status];
}

function statusIcon(status: ScheduleViewOccurrence["computed_status"]) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  if (status === "needs_source" || status === "overdue") return <CircleAlert className="h-4 w-4" aria-hidden="true" />;
  return <Clock3 className="h-4 w-4" aria-hidden="true" />;
}

function isUnknownDate(item: ScheduleViewOccurrence): boolean {
  return !item.due_on && !item.due_ym && !item.period_key;
}

function isInternalDeadline(item: ScheduleViewOccurrence): boolean {
  return item.date_kind.includes("社内");
}

function needsSourceCheck(item: ScheduleViewOccurrence): boolean {
  return item.computed_status === "needs_source"
    || item.freshness_state === "source_stale"
    || item.freshness_state === "rule_stale";
}

const ROLLING_STATUS_TONE: Record<ScheduleViewOccurrence["computed_status"], string> = {
  overdue: "border-l-[#a8330a] bg-[#f3d9c8] text-[#5a1c05]",
  due_today: "border-l-[#a8330a] bg-[#f7e3d3] text-[#5a1c05]",
  due_soon: "border-l-[#96700a] bg-[#f2e5c3] text-[#4a3706]",
  open: "border-l-[#2a2118]/50 bg-[#fbf6ea] text-[#2a2118]",
  completed: "border-l-[#1f4d36] bg-[#e3ece3] text-[#173a29]",
  cancelled: "border-l-[#8a8074] bg-[#eeeae0] text-[#6b6255]",
  needs_source: "border-l-[#a8330a] bg-[#f3d9c8] text-[#5a1c05]",
};

function formatDayAgendaHeading(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return `${parsed.getUTCMonth() + 1}月${parsed.getUTCDate()}日（${CALENDAR_WEEKDAYS[(parsed.getUTCDay() + 6) % 7]}）`;
}

export function AdminScheduleClient({ initialData }: Props) {
  const [data] = useState(initialData);
  const today = todayJst();
  const todayYear = Number(today.slice(0, 4));
  const initialMonth = Number(today.slice(5, 7));
  const initialYear = todayYear;
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [year, setYear] = useState(initialYear);
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const [agendaDate, setAgendaDate] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState<ScheduleCategory | "all">("all");
  const [projectId, setProjectId] = useState("all");
  const [ownerId, setOwnerId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rebuildReason, setRebuildReason] = useState("");
  const [rebuilding, setRebuilding] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const occurrenceId = searchParams.get("occurrence");
    if (occurrenceId && data.occurrences.some((item) => item.occurrence_id === occurrenceId)) setSelectedId(occurrenceId);
  }, [data.occurrences, searchParams]);

  const visibleItems = useMemo(() => data.occurrences.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (projectId !== "all" && item.project_id !== projectId) return false;
    if (ownerId !== "all" && item.owner_member_id !== ownerId) return false;
    if (status !== "all" && item.computed_status !== status) return false;
    return true;
  }), [category, data.occurrences, ownerId, projectId, status]);

  const yearItems = useMemo(() => visibleItems.filter((item) => {
    const candidate = item.due_on?.slice(0, 4) ?? item.due_ym?.slice(0, 4) ?? item.period_key?.slice(0, 4);
    return candidate === String(year) || item.computed_status === "needs_source";
  }), [visibleItems, year]);

  const selected = selectedId ? data.occurrences.find((item) => item.occurrence_id === selectedId) ?? null : null;
  const rollingWindow = useMemo(() => rollingScheduleWindow(today), [today]);
  const rollingMonths: CalendarMonth[] = useMemo(
    () => rollingCalendarMonths(rollingWindow.from.slice(0, 7).replace("-", ""), rollingWindow.to.slice(0, 7).replace("-", ""))
      .map(({ year: rollingYear, month }) => ({ year: rollingYear, month, key: monthKey(rollingYear, month) })),
    [rollingWindow],
  );
  const rollingMonthKeys = useMemo(() => new Set(rollingMonths.map((item) => item.key)), [rollingMonths]);
  const rollingItems = useMemo(() => visibleItems.filter((item) => {
    const key = itemMatchesMonthKey(item);
    return key ? rollingMonthKeys.has(key) : item.computed_status === "needs_source";
  }), [visibleItems, rollingMonthKeys]);
  const rollingUnknownItems = rollingItems.filter((item) => item.computed_status === "needs_source" && isUnknownDate(item));
  const rollingNearest = rollingItems.filter((item) => item.computed_status !== "completed" && item.computed_status !== "cancelled").slice(0, 6);
  const categoryOptions = [...new Set(data.occurrences.map((item) => item.category))].sort();
  const firstYear = Number(initialData.from.slice(0, 4));
  const lastYear = Number(initialData.to.slice(0, 4));
  const years = Array.from({ length: Math.max(1, lastYear - firstYear + 1) }, (_, index) => firstYear + index);
  const desktopAgendaItems = agendaDate ? rollingItems.filter((item) => item.due_on === agendaDate && isDatePrecisionDay(item)) : [];
  const paymentTiming = paymentTimingSummary(visibleItems, year, today);
  const nextPaymentItem = nextPayment(paymentTiming.upcoming.items, today) as ScheduleViewOccurrence | null;

  function focusMonth(month: number) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    window.requestAnimationFrame(() => document.getElementById(`schedule-operations-month-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function focusRollingMonth(key: string) {
    window.requestAnimationFrame(() => document.getElementById(`rolling-month-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function goToToday() {
    setSelectedDate(today);
    setAgendaDate(today);
    focusRollingMonth(monthKey(todayYear, initialMonth));
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    setAgendaDate(date);
  }

  async function rebuild() {
    const reason = rebuildReason.trim();
    if (!reason || !window.confirm("正本から運営カレンダーを再生成する？手入力の予定は作られないよ。")) return;
    setRebuilding(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/schedule/rebuild", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason, from: initialData.from, to: initialData.to }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.errors?.join(", ") || "再生成に失敗");
      setNotice(`再生成完了: ${result.generated}件 / 根拠不足 ${result.needsSource}件`);
      window.location.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "再生成に失敗");
    } finally {
      setRebuilding(false);
    }
  }

  async function recordAction(action: "completed" | "not_applicable" | "reopened") {
    if (!selected || selected.notification_owner === "payment_obligation") return;
    setActionBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/schedule/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occurrenceId: selected.occurrence_id, action, reason: actionReason, evidenceRef }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "行動履歴の記録に失敗");
      setNotice("行動履歴を追加したよ");
      window.location.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "行動履歴の記録に失敗");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-foreground text-background">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">管理 / 会社運営</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">管理カレンダー</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">納税・源泉徴収・社会保険・株主総会と、それに先立つ書類作成を12か月で見渡す。契約・提出期限も同じ時間軸で確認できる。</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="schedule-rebuild-reason">再生成理由</label>
            <input id="schedule-rebuild-reason" value={rebuildReason} onChange={(event) => setRebuildReason(event.target.value)} placeholder="再生成理由" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:w-44" />
            <button type="button" onClick={rebuild} disabled={rebuilding || !rebuildReason.trim()} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              <RefreshCcw className={rebuilding ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
              再生成
            </button>
          </div>
          <span className="text-right text-xs text-muted-foreground">日付・金額・担当者の手入力はできない</span>
        </div>
      </header>

      {notice && <div role="status" className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{notice}</div>}
      {data.meta.errors.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div><p className="font-semibold">運営カレンダーの正本テーブルが未適用、または読み込みに失敗してる</p><p className="mt-1 text-xs leading-5">migration 178 を適用してから再生成して。既存の契約・債務データはこの画面から書き換えないよ。</p></div>
        </div>
      )}

      <OverdueStatutoryAlert items={data.occurrences} today={today} />

      <section aria-label="カレンダーの状態" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border py-3 text-sm">
        <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /><span className="text-muted-foreground">生成済み</span><strong>{data.meta.generatedCount}</strong></span>
        <span className="inline-flex items-center gap-2"><CircleAlert className="h-4 w-4 text-amber-700" aria-hidden="true" /><span className="text-muted-foreground">根拠不足</span><strong>{data.meta.needsSourceCount}</strong></span>
        <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-sky-600" aria-hidden="true" /><span className="text-muted-foreground">鮮度・ルール確認</span><strong>{data.meta.staleOccurrenceCount + data.meta.staleRuleCount}</strong></span>
        <span className="ml-auto text-xs text-muted-foreground">{viewMode === "calendar" ? `${rollingItems.length}件を表示` : `${year}年 / ${yearItems.length}件を表示`}</span>
      </section>

      <div role="tablist" aria-label="運営カレンダー表示" className="flex w-full border-b border-border">
        <button type="button" role="tab" aria-selected={viewMode === "calendar"} data-testid="schedule-calendar-tab" onClick={() => setViewMode("calendar")} className={`min-h-11 border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === "calendar" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>カレンダー</button>
        <button type="button" role="tab" aria-selected={viewMode === "operations"} data-testid="schedule-operations-tab" onClick={() => setViewMode("operations")} className={`min-h-11 border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === "operations" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>年間運営</button>
      </div>

      <section className="flex flex-wrap items-center gap-2 border border-border bg-card p-3" aria-label="表示フィルター">
        <span className="inline-flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />絞り込み</span>
        <FilterSelect label="カテゴリ" value={category} onChange={(value) => setCategory(value as ScheduleCategory | "all")} options={["all", ...categoryOptions]} labels={{ all: "すべて", ...CATEGORY_LABELS }} />
        <FilterSelect label="プロジェクト" value={projectId} onChange={setProjectId} options={["all", ...data.projects.map((item) => item.project_id)]} labels={{ all: "すべて", ...Object.fromEntries(data.projects.map((item) => [item.project_id, item.project_name])) }} />
        <FilterSelect label="担当" value={ownerId} onChange={setOwnerId} options={["all", ...data.members.map((item) => item.member_id)]} labels={{ all: "すべて", ...Object.fromEntries(data.members.map((item) => [item.member_id, item.member_name ?? item.code_name])) }} />
        <FilterSelect label="状態" value={status} onChange={(value) => setStatus(value as StatusFilter)} options={Object.keys(STATUS_LABELS) as StatusFilter[]} labels={STATUS_LABELS} />
        <span className="ml-auto px-1 text-xs text-muted-foreground">{visibleItems.length}件</span>
      </section>

      {viewMode === "operations" ? (
        <>
          <AnnualPaymentCockpit timing={paymentTiming} nextItem={nextPaymentItem} />
          <PaymentRail year={year} timing={paymentTiming} onFocusMonth={focusMonth} />
          <section aria-labelledby="annual-operations-title" data-testid="annual-operations-view" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 id="annual-operations-title" className="text-lg font-semibold">{year}年の年間運営</h2><p className="text-sm text-muted-foreground">納付を先に確認し、提出・契約は「その他の運営」で追う。</p></div>
              <DeadlineRailSelector year={year} years={years} onChange={(nextYear) => { setYear(nextYear); setSelectedDate(null); setAgendaDate(null); }} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="annual-operation-months">
              {Array.from({ length: 12 }, (_, index) => ({ key: monthKey(year, index + 1), year, month: index + 1 })).map((item) => <OperationsMonthCard key={item.key} calendarMonth={item} items={yearItems} timing={paymentTiming} onSelect={setSelectedId} />)}
            </div>
          </section>
        </>
      ) : (
        <section aria-labelledby="rolling-calendar-title" data-testid="rolling-schedule-calendar" className="space-y-4 border border-[#d9cba8] bg-[#f8f1e0] p-4 text-[#2a2118] sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d9cba8] pb-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#8a6d3b]">管理期間</p>
              <h2 id="rolling-calendar-title" className="mt-1 text-lg font-semibold">{monthLabel(rollingMonths[0]?.year ?? todayYear, rollingMonths[0]?.month ?? initialMonth)} 〜 {monthLabel(rollingMonths[rollingMonths.length - 1]?.year ?? todayYear, rollingMonths[rollingMonths.length - 1]?.month ?? initialMonth)}</h2>
            </div>
            <button type="button" onClick={goToToday} className="min-h-11 shrink-0 rounded-lg border border-[#a8330a]/40 bg-[#a8330a]/10 px-3 text-xs font-semibold text-[#5a1c05] hover:bg-[#a8330a]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">今日へ移動</button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3" data-testid="rolling-calendar-months">
            {rollingMonths.map((item) => <RollingCalendarMonth key={item.key} calendarMonth={item} items={rollingItems} today={today} isCurrent={item.year === todayYear && item.month === initialMonth} selectedDate={selectedDate} onSelectId={setSelectedId} onSelectDate={selectDate} />)}
          </div>
          {agendaDate && <DayAgenda date={agendaDate} items={desktopAgendaItems} onSelect={setSelectedId} />}
        </section>
      )}

      <StatutoryObligationCatalogSection items={data.occurrences} facts={data.facts} today={today} />

      <section className="grid gap-4 lg:grid-cols-2" aria-label="カレンダー補助情報">
        <div className="border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">次に見る</h2><ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></div>
          <p className="mt-1 text-xs text-muted-foreground">未完了・根拠不足を期限の近い順に表示</p>
          <div className="mt-3 space-y-1">{rollingNearest.length ? rollingNearest.map((item) => <ScheduleListItem key={item.occurrence_id} item={item} compact onSelect={setSelectedId} />) : <p className="py-5 text-sm text-muted-foreground">確認対象はないよ。</p>}</div>
        </div>
        <div className="border border-dashed border-border bg-muted/20 p-4">
          <p className="font-semibold">日付を生成できない締切</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">月自体も不明な予定は、架空の日へ置かずここで常時確認できる。</p>
          <div className="mt-3 space-y-1">{rollingUnknownItems.length ? rollingUnknownItems.map((item) => <ScheduleListItem key={item.occurrence_id} item={item} compact onSelect={setSelectedId} />) : <p className="py-4 text-sm text-muted-foreground">該当なし</p>}</div>
        </div>
      </section>

      <div className="border border-dashed border-border bg-muted/20 p-4 text-sm">
        <p className="font-semibold">正本を直す場所</p>
        <p className="mt-1 leading-6 text-muted-foreground">日付・金額・担当者の誤りは、契約・債務・報告書・action item側を修正してから再生成してね。PJ別の請求書発行・入金確認はここには載せない。</p>
      </div>

      {selected && <DetailDrawer item={selected} onClose={() => setSelectedId(null)} actionBusy={actionBusy} actionReason={actionReason} evidenceRef={evidenceRef} onReasonChange={setActionReason} onEvidenceChange={setEvidenceRef} onAction={recordAction} />}
    </div>
  );
}

function weekdayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return CALENDAR_WEEKDAYS[(date.getUTCDay() + 6) % 7];
}

function paymentDateLabel(item: ScheduleViewOccurrence): string {
  if (item.due_on) {
    const date = new Date(`${item.due_on}T00:00:00Z`);
    return `${date.getUTCMonth() + 1}/${date.getUTCDate()}（${weekdayLabel(item.due_on)}）`;
  }
  if (item.due_ym) return `${item.due_ym.slice(0, 4)}年${Number(item.due_ym.slice(4, 6))}月（日付未確定）`;
  return "日付未確定";
}

function AnnualPaymentCockpit({ timing, nextItem }: { timing: PaymentTimingSummary<ScheduleViewOccurrence>; nextItem: ScheduleViewOccurrence | null }) {
  return <section data-testid="annual-payment-summary" aria-labelledby="annual-payment-summary-title" className="border border-border bg-card">
    <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(240px,1.05fr)_minmax(0,1.95fr)]">
      <div className="border-b border-border pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">今年の法定納付</p>
        <h2 id="annual-payment-summary-title" className="mt-2 text-sm font-semibold">今から要対応の口座流出</h2>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatScheduleYen(timing.actionableAmountYen)}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">納付済みは含めない。要照合と、これから口座から出る予定の合計。</p>
      </div>
      <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">納付済み</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-emerald-800">{formatScheduleYen(timing.paid.totalAmountYen)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">要照合</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-amber-800">{formatScheduleYen(timing.reconcile.totalAmountYen)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">これからの口座流出</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{formatScheduleYen(timing.upcoming.totalAmountYen)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">年間合計（参考）</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{formatScheduleYen(timing.all.totalAmountYen)}</dd></div>
      </dl>
    </div>
    <div className="grid gap-4 border-t border-border px-4 py-4 sm:grid-cols-2 sm:px-5">
      <div><p className="text-xs font-semibold text-muted-foreground">次の口座流出</p>{nextItem ? <div className="mt-1"><p className="font-semibold">{paymentDateLabel(nextItem)} · {shortTitle(nextItem)}</p><p className="mt-1 break-words text-sm">{counterpartyFor(nextItem)} <span className="mx-1 text-muted-foreground">/</span> <span className="font-semibold tabular-nums">{formatScheduleYen(nextItem.amount_yen)}</span> <span className="ml-1 text-xs text-muted-foreground">{paymentStatusLabel(nextItem)}</span></p></div> : <p className="mt-1 text-sm text-muted-foreground">今日以降の未完了納付はないよ。</p>}</div>
      <div><p className="text-xs font-semibold text-muted-foreground">これからの支払ピーク月</p><p className="mt-1 font-semibold">{timing.upcoming.peakMonth ? `${timing.upcoming.peakMonth.month}月 · ${formatScheduleYen(timing.upcoming.peakMonth.amountYen)}` : "該当なし"}</p><p className="mt-1 text-xs text-muted-foreground">月を押すと、その月の運営カードへ移動</p></div>
    </div>
  </section>;
}

function PaymentRail({ year, timing, onFocusMonth }: { year: number; timing: PaymentTimingSummary<ScheduleViewOccurrence>; onFocusMonth: (month: number) => void }) {
  const monthly = timing.upcoming.monthly.map((month, index) => ({ ...month, amountYen: month.amountYen + timing.reconcile.monthly[index].amountYen, itemCount: month.itemCount + timing.reconcile.monthly[index].itemCount, unknownCount: month.unknownCount + timing.reconcile.monthly[index].unknownCount }));
  const maxAmount = Math.max(1, ...monthly.map((month) => month.amountYen));
  return <section aria-labelledby="payment-rail-title" className="border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 id="payment-rail-title" className="font-semibold">これからの支払レール</h2><p className="mt-1 text-xs text-muted-foreground">要照合と今後の法定納付だけ。納付済みは棒に含めない。</p></div><span className="text-xs text-muted-foreground">{year}年 / 12か月</span></div>
    <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12" data-testid="annual-payment-rail">
      {monthly.map((month) => <button type="button" key={month.key} onClick={() => onFocusMonth(month.month)} aria-label={`${year}年${month.month}月の今から要対応の支払 ${formatScheduleYen(month.amountYen)}、${month.itemCount}件`} className="group flex min-h-28 min-w-0 flex-col justify-end rounded-lg border border-border/70 bg-background px-2 py-2 text-left transition-colors hover:border-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="mb-2 min-h-8 break-words text-[11px] font-semibold leading-4 tabular-nums group-hover:text-foreground">{month.amountYen ? formatScheduleYen(month.amountYen) : month.unknownCount ? "未取得" : "—"}</span>
        <span className="flex h-12 items-end"><span aria-hidden="true" className={`block w-full rounded-t-sm ${month.unknownCount > 0 ? "bg-amber-400" : month.amountYen ? "bg-foreground/75" : "bg-muted"}`} style={{ height: `${month.amountYen ? Math.max(12, (month.amountYen / maxAmount) * 100) : 8}%` }} /></span>
        <span className="mt-2 flex items-center justify-between gap-1 text-[11px]"><span className="font-semibold">{month.month}月</span><span className="text-muted-foreground">{month.itemCount}件</span></span>
      </button>)}
    </div>
  </section>;
}

function OperationsMonthCard({ calendarMonth, items, timing, onSelect }: { calendarMonth: CalendarMonth; items: ScheduleViewOccurrence[]; timing: PaymentTimingSummary<ScheduleViewOccurrence>; onSelect: (id: string) => void }) {
  const paymentItems = items.filter((item) => isAnnualStatutoryPayment(item) && paymentMonthKey(item) === calendarMonth.key).sort((left, right) => String(left.due_on ?? left.due_ym ?? "").localeCompare(String(right.due_on ?? right.due_ym ?? "")));
  const paidIds = new Set(timing.paid.items.map((item) => item.occurrence_id));
  const reconcileIds = new Set(timing.reconcile.items.map((item) => item.occurrence_id));
  const paidItems = paymentItems.filter((item) => paidIds.has(item.occurrence_id));
  const reconcileItems = paymentItems.filter((item) => reconcileIds.has(item.occurrence_id));
  const upcomingItems = paymentItems.filter((item) => !paidIds.has(item.occurrence_id) && !reconcileIds.has(item.occurrence_id));
  const otherItems = items.filter((item) => !isAnnualStatutoryPayment(item) && itemMatchesMonth(item, calendarMonth.key));
  return <section id={`schedule-operations-month-${calendarMonth.year}-${String(calendarMonth.month).padStart(2, "0")}`} className="min-w-0 border border-border bg-card" aria-labelledby={`operations-month-title-${calendarMonth.key}`}>
    <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3"><div><h3 id={`operations-month-title-${calendarMonth.key}`} className="text-base font-semibold">{monthLabel(calendarMonth.year, calendarMonth.month)}</h3><p className="mt-1 text-xs text-muted-foreground">法定納付 {paymentItems.length}件</p></div><p className="text-right text-xs leading-5 text-muted-foreground">支払済みと予定を分けて表示</p></header>
    <div className="p-3 sm:p-4">
      <PaymentLane title="これからの口座流出" items={upcomingItems} lane="upcoming" onSelect={onSelect} />
      <PaymentLane title="要照合" items={reconcileItems} lane="reconcile" onSelect={onSelect} />
      <PaymentLane title="納付済み" items={paidItems} lane="paid" onSelect={onSelect} />
      <div className="mt-4 border-t border-border pt-3"><p className="text-xs font-semibold tracking-wide text-muted-foreground">その他の運営</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">報告・契約など。支払準備とは分けて確認。</p><div className="mt-2 space-y-1">{otherItems.length ? otherItems.map((item) => <ScheduleListItem key={item.occurrence_id} item={item} compact onSelect={onSelect} />) : <p className="py-2 text-sm text-muted-foreground">該当なし</p>}</div></div>
    </div>
  </section>;
}

function PaymentLane({ title, items, lane, onSelect }: { title: string; items: ScheduleViewOccurrence[]; lane: "upcoming" | "reconcile" | "paid"; onSelect: (id: string) => void }) {
  if (items.length === 0) return null;
  return <div className="mb-4 last:mb-0"><p className={`text-xs font-semibold tracking-wide ${lane === "paid" ? "text-emerald-800" : lane === "reconcile" ? "text-amber-800" : "text-foreground"}`}>{title}</p><div className="mt-2 space-y-2">{items.map((item) => <PaymentRow key={item.occurrence_id} item={item} lane={lane} onSelect={onSelect} />)}</div></div>;
}

function PaymentRow({ item, lane, onSelect }: { item: ScheduleViewOccurrence; lane: "upcoming" | "reconcile" | "paid"; onSelect: (id: string) => void }) {
  const amountState = paymentStatusLabel(item);
  return <button type="button" onClick={() => onSelect(item.occurrence_id)} className={`block min-h-11 w-full rounded-lg border border-border/70 border-l-4 p-3 text-left transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${STATUS_STYLES[item.computed_status]}`}>
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><span className="shrink-0 text-sm font-semibold tabular-nums">{paymentDateLabel(item)}</span><span className="break-words text-sm font-semibold leading-5">{item.title}</span></div>
    <div className="mt-2 grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-3"><p className="break-words text-xs leading-5"><span className="text-muted-foreground">支払先:</span> {counterpartyFor(item)}</p><p className="break-words text-base font-semibold leading-5 tabular-nums">{formatScheduleYen(item.amount_yen)}</p></div>
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"><span className={`font-semibold ${amountState === "概算" ? "text-amber-800" : "text-foreground"}`}>{amountState}</span><span className="text-muted-foreground">{lane === "paid" ? "納付済み" : lane === "reconcile" ? "要照合" : "口座流出予定"}</span><span className="text-muted-foreground">{stateLabel(item)}</span></div>
  </button>;
}

function DeadlineRailSelector({ year, years, onChange }: { year: number; years: number[]; onChange: (year: number) => void }) {
  return <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm"><span className="text-xs text-muted-foreground">対象年</span><select value={year} onChange={(event) => onChange(Number(event.target.value))} className="bg-transparent font-semibold outline-none">{years.map((item) => <option key={item} value={item}>{item}年</option>)}</select></label>;
}

function RollingCalendarMonth({ calendarMonth, items, today, isCurrent, selectedDate, onSelectId, onSelectDate }: { calendarMonth: CalendarMonth; items: ScheduleViewOccurrence[]; today: string; isCurrent: boolean; selectedDate?: string | null; onSelectId: (id: string) => void; onSelectDate: (date: string) => void }) {
  const { year, month, key } = calendarMonth;
  const cells = buildMonthGrid(year, month);
  const monthItems = items.filter((item) => itemMatchesMonth(item, key));
  const datedItems = monthItems.filter((item) => isDatePrecisionDay(item) && item.due_on?.startsWith(`${year}-${String(month).padStart(2, "0")}-`));
  const orderedItems = [...monthItems].sort((left, right) => {
    const leftDate = left.due_on ?? `${left.due_ym ?? left.period_key ?? "999999"}-99`;
    const rightDate = right.due_on ?? `${right.due_ym ?? right.period_key ?? "999999"}-99`;
    return leftDate.localeCompare(rightDate) || left.title.localeCompare(right.title);
  });

  return (
    <section id={`rolling-month-${key}`} className={`min-w-0 border bg-[#fbf6ea] ${isCurrent ? "border-2 border-[#a8330a]" : "border border-[#d9cba8]"}`} aria-labelledby={`rolling-month-title-${key}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-[#d9cba8] px-3 py-2.5">
        <h3 id={`rolling-month-title-${key}`} className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#2a2118]">
          {monthLabel(year, month)}
          {isCurrent && <span className="rounded-sm bg-[#a8330a] px-1.5 py-0.5 text-[10px] font-semibold text-[#fbf6ea]">今月</span>}
        </h3>
        <span className="text-xs text-[#6b5a3f]">{monthItems.length}件</span>
      </div>
      <div className="grid grid-cols-7 border-b border-[#d9cba8] bg-[#efe4c8]" aria-hidden="true">
        {CALENDAR_WEEKDAYS.map((weekday, index) => <span key={weekday} className={`py-1 text-center text-[10px] font-semibold ${index >= 5 ? "text-[#8a6d3b]" : "text-[#4a3d29]"}`}>{weekday}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, index) => {
          const dateItems = cell.date ? datedItems.filter((item) => item.due_on === cell.date) : [];
          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          return <div key={cell.date ?? `outside-${index}`} className={`relative min-h-[58px] min-w-0 overflow-hidden border-b border-r border-[#e4d8b8] p-1 ${cell.outside ? "bg-[#efe9d5]/60" : cell.weekend ? "bg-[#f3ecd7]" : "bg-[#fbf6ea]"} ${isToday ? "outline outline-2 -outline-offset-2 outline-[#a8330a]" : ""} ${isSelected ? "bg-[#e3ece3]" : ""}`}>
            {cell.day && cell.date ? <button type="button" onClick={() => onSelectDate(cell.date ?? "")} className="flex min-h-12 w-full flex-col items-start justify-between rounded px-1 py-0.5 text-left text-xs font-semibold text-[#6b5a3f] hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${cell.date}の締切 ${dateItems.length}件`}><span>{cell.day}</span>{dateItems.length > 0 && <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#8b2d0b]"><span className="h-1.5 w-1.5 rounded-full bg-[#a8330a]" />{dateItems.length}件</span>}</button> : <span className="block min-h-12" aria-hidden="true" />}
          </div>;
        })}
      </div>
      <div className="border-t border-[#d9cba8] bg-[#fffaf0] px-3 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-semibold tracking-wide text-[#4a3d29]">この月にやること</p>
          <span className="text-[10px] text-[#8a6d3b]">{orderedItems.length}件</span>
        </div>
        {orderedItems.length > 0 ? <div className="mt-2 space-y-1.5">{orderedItems.map((item) => <MonthlyActionRow key={item.occurrence_id} item={item} onSelect={() => onSelectId(item.occurrence_id)} />)}</div> : <p className="py-3 text-xs text-[#8a6d3b]">予定なし</p>}
      </div>
    </section>
  );
}

function monthlyActionDate(item: ScheduleViewOccurrence): string {
  if (item.due_on) {
    const date = new Date(`${item.due_on}T00:00:00Z`);
    return `${date.getUTCDate()}日（${CALENDAR_WEEKDAYS[(date.getUTCDay() + 6) % 7]}）`;
  }
  if (item.due_ym) return "月内";
  if (item.period_key) return "期間内";
  return "未確定";
}

function MonthlyActionRow({ item, onSelect }: { item: ScheduleViewOccurrence; onSelect: () => void }) {
  const amount = shortAmountLabel(item);
  return <button type="button" onClick={onSelect} aria-label={`${monthlyActionDate(item)} ${item.title} ${stateLabel(item)}${amount ? ` ${amount}` : ""}`} className={`grid min-h-14 w-full min-w-0 grid-cols-[58px_minmax(0,1fr)] gap-2 rounded-sm border border-transparent border-l-[3px] px-2 py-2 text-left transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ROLLING_STATUS_TONE[item.computed_status]}`}>
    <span className="text-xs font-semibold tabular-nums text-current">{monthlyActionDate(item)}</span>
    <span className="min-w-0">
      <span className="block break-words text-[13px] font-semibold leading-[1.45]">{item.title}</span>
      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-4 opacity-80">
        <span>{CATEGORY_LABELS[item.category]}</span>
        <span>{stateLabel(item)}</span>
        {isInternalDeadline(item) && <span className="rounded-sm bg-black/10 px-1">社内準備</span>}
        {needsSourceCheck(item) && <span className="rounded-sm bg-black/10 px-1">正本要確認</span>}
        {amount && <span className="font-semibold tabular-nums">{amount}</span>}
      </span>
    </span>
  </button>;
}

function DayAgenda({ date, items, onSelect, emptyLabel = "この日の締切はないよ。" }: { date: string | null; items: ScheduleViewOccurrence[]; onSelect: (id: string) => void; emptyLabel?: string }) {
  if (!date) return <div className="border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">{emptyLabel}</div>;
  return <section className="border border-border bg-card p-4" aria-labelledby="selected-day-agenda-title"><div className="flex items-baseline justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">選択日</p><h3 id="selected-day-agenda-title" className="mt-1 font-semibold">{formatDayAgendaHeading(date)}</h3></div><span className="text-xs text-muted-foreground">{items.length}件</span></div><div className="mt-3 space-y-1">{items.length ? items.map((item) => <ScheduleListItem key={item.occurrence_id} item={item} onSelect={onSelect} />) : <p className="py-4 text-sm text-muted-foreground">この日の締切はないよ。</p>}</div></section>;
}

function FilterSelect({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels: Record<string, string> }) {
  return <label className="flex h-10 min-w-[132px] items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs"><span className="text-muted-foreground">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none">{options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}</select></label>;
}

function ScheduleListItem({ item, onSelect, compact = false }: { item: ScheduleViewOccurrence; onSelect: (id: string) => void; compact?: boolean }) {
  const Icon = CATEGORY_ICONS[item.category] ?? CalendarDays;
  return <button type="button" onClick={() => onSelect(item.occurrence_id)} className={`group flex min-h-11 w-full items-start gap-2 rounded-lg px-2 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${compact ? "py-1.5" : "py-2"}`}><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border-l-[3px] ${STATUS_STYLES[item.computed_status]}`}><Icon className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-start gap-2"><span className="break-words text-sm font-medium leading-5">{shortTitle(item)}</span>{item.computed_status === "needs_source" && <span className="shrink-0 text-[10px] font-semibold text-amber-700">要根拠</span>}</span><span className="mt-0.5 block break-words text-xs leading-5 text-muted-foreground">{dateLabel(item)} · {CATEGORY_LABELS[item.category]}</span></span><span className="hidden shrink-0 text-xs text-muted-foreground group-hover:block">詳細</span></button>;
}

function DetailDrawer({ item, onClose, actionBusy, actionReason, evidenceRef, onReasonChange, onEvidenceChange, onAction }: { item: ScheduleViewOccurrence; onClose: () => void; actionBusy: boolean; actionReason: string; evidenceRef: string; onReasonChange: (value: string) => void; onEvidenceChange: (value: string) => void; onAction: (action: "completed" | "not_applicable" | "reopened") => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 lg:items-stretch lg:justify-end" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="schedule-detail-title" className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl lg:max-h-none lg:w-[min(480px,100vw)] lg:rounded-none lg:border-y-0 lg:border-r-0"><header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Occurrence detail</p><h2 id="schedule-detail-title" className="mt-1 break-words text-lg font-semibold leading-7">{item.title}</h2></div><button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="詳細を閉じる"><X className="h-5 w-5" aria-hidden="true" /></button></header><div className="min-h-0 flex-1 overflow-y-auto px-5 py-5"><div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${STATUS_STYLES[item.computed_status]}`}>{statusIcon(item.computed_status)}{stateLabel(item)}</div><div className="mt-5 space-y-4"><DetailRow label="期限" value={fullDateLabel(item)} /><DetailRow label="金額" value={amountLabel(item)} /><DetailRow label="担当" value={item.owner_label ?? "担当未確定"} /><DetailRow label="プロジェクト" value={item.project_label ?? "会社全体"} /><DetailRow label="生成状態" value={`${stateLabel(item)} / ${item.source_kind}${item.rule_version ? ` / ルール ${item.rule_version}` : ""}`} />{item.missing_reason && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">根拠が足りない理由</p><p className="mt-1 leading-6">{item.missing_reason}</p></div>}<SourceBlock item={item} /></div>{item.notification_owner !== "payment_obligation" && <div className="mt-6 border-t border-border pt-5"><h3 className="text-sm font-semibold">行動履歴を追加</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">日付・金額・担当者の変更ではなく、確認・完了の履歴だけを追記する。</p><label className="mt-3 block text-xs font-medium">理由<textarea value={actionReason} onChange={(event) => onReasonChange(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border bg-card p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="何を確認したか" /></label><label className="mt-3 block text-xs font-medium">根拠リンク / 参照先<input value={evidenceRef} onChange={(event) => onEvidenceChange(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="https://… または正本ID" /></label><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={actionBusy || (!actionReason.trim() && !evidenceRef.trim())} onClick={() => onAction("completed")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50"><Check className="h-4 w-4" aria-hidden="true" />完了にする</button><button type="button" disabled={actionBusy || (!actionReason.trim() && !evidenceRef.trim())} onClick={() => onAction("not_applicable")} className="min-h-11 rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-50">対象外</button></div>{item.latest_action && <button type="button" disabled={actionBusy} onClick={() => onAction("reopened")} className="mt-2 min-h-11 w-full rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-50">完了を取り消す（履歴を追記）</button>}</div>}</div></section></div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-b border-border/70 pb-3"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="min-w-0 text-sm leading-6">{value}</dd></div>;
}

function SourceBlock({ item }: { item: ScheduleViewOccurrence }) {
  const refs = Array.isArray(item.official_refs_json) ? item.official_refs_json : [];
  return <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs font-semibold text-muted-foreground">正本 / 根拠</p><div className="mt-2 space-y-2 text-sm"><p className="break-words font-mono text-xs text-muted-foreground">{item.source_kind}{item.source_id ? `:${item.source_id}` : ""}</p>{item.resolution_href && <Link href={item.resolution_href} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground underline underline-offset-4">正本を開く<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>}{refs.map((ref, index) => { const record = ref as { label?: string; url?: string; asOf?: string }; if (!record.url) return null; return <a key={`${record.url}-${index}`} href={record.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground underline underline-offset-4"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{record.label ?? "公式ルール"}（確認日 {record.asOf ?? "未設定"}）</a>; })}</div></div>;
}
