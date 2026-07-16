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
  ChevronLeft,
  ChevronRight,
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
import { buildMonthGrid, CALENDAR_WEEKDAYS, isDatePrecisionDay } from "@/lib/admin-schedule/calendar";
import { todayJst } from "@/lib/admin-schedule/date";
import type {
  AmountRole,
  ScheduleCategory,
  ScheduleViewData,
  ScheduleViewOccurrence,
} from "@/lib/admin-schedule/types";

type Props = { initialData: ScheduleViewData };
type StatusFilter = "all" | ScheduleViewOccurrence["computed_status"];
type CalendarMonth = { year: number; month: number; key: string };

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

const STATUS_DOT_STYLES: Record<ScheduleViewOccurrence["computed_status"], string> = {
  overdue: "bg-rose-600",
  due_today: "bg-amber-600",
  due_soon: "bg-amber-400",
  open: "bg-sky-500",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-400",
  needs_source: "bg-amber-700",
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

function itemMatchesMonth(item: ScheduleViewOccurrence, key: string): boolean {
  return item.due_on?.slice(0, 7).replace("-", "") === key || item.due_ym === key || item.period_key === key;
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

function formatDayAgendaHeading(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return `${parsed.getUTCMonth() + 1}月${parsed.getUTCDate()}日（${CALENDAR_WEEKDAYS[(parsed.getUTCDay() + 6) % 7]}）`;
}

export function AdminScheduleClient({ initialData }: Props) {
  const [data] = useState(initialData);
  const initialYear = Number(initialData.from.slice(0, 4));
  const today = todayJst();
  const todayYear = Number(today.slice(0, 4));
  const initialMonth = Number(today.slice(5, 7));
  const [year, setYear] = useState(initialYear);
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const [mobileMonth, setMobileMonth] = useState(initialYear === todayYear ? initialMonth : 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialYear === todayYear ? today : null);
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
  const monthKeys = Array.from({ length: 12 }, (_, index) => monthKey(year, index + 1));
  const monthList: CalendarMonth[] = monthKeys.map((key, index) => ({ key, year, month: index + 1 }));
  const yearUnknownItems = yearItems.filter((item) => item.computed_status === "needs_source" && isUnknownDate(item));
  const nearest = yearItems.filter((item) => item.computed_status !== "completed" && item.computed_status !== "cancelled").slice(0, 6);
  const categoryOptions = [...new Set(data.occurrences.map((item) => item.category))].sort();
  const years = [...new Set([Number(initialData.from.slice(0, 4)), Number(initialData.to.slice(0, 4)), todayYear])].sort();
  const mobileKey = monthKey(year, mobileMonth);
  const mobileItems = yearItems.filter((item) => itemMatchesMonth(item, mobileKey));
  const mobileSelectedDate = selectedDate && selectedDate.startsWith(`${year}-${String(mobileMonth).padStart(2, "0")}-`) ? selectedDate : null;
  const mobileAgendaItems = mobileSelectedDate ? mobileItems.filter((item) => item.due_on === mobileSelectedDate && isDatePrecisionDay(item)) : [];
  const desktopAgendaItems = agendaDate ? yearItems.filter((item) => item.due_on === agendaDate && isDatePrecisionDay(item)) : [];

  function focusMonth(month: number) {
    setActiveMonth(month);
    setMobileMonth(month);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    window.requestAnimationFrame(() => document.getElementById(`schedule-month-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function setMobileCalendarMonth(month: number) {
    const next = Math.min(12, Math.max(1, month));
    setMobileMonth(next);
    setSelectedDate(null);
    setAgendaDate(null);
  }

  function shiftMobileMonth(delta: number) {
    const next = new Date(Date.UTC(year, mobileMonth - 1 + delta, 1));
    setYear(next.getUTCFullYear());
    setMobileMonth(next.getUTCMonth() + 1);
    setSelectedDate(null);
    setAgendaDate(null);
  }

  function goToToday() {
    setYear(todayYear);
    setMobileMonth(initialMonth);
    setSelectedDate(today);
    setAgendaDate(today);
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    setAgendaDate(date);
  }

  function showAgenda(date: string) {
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin / Operations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">運営カレンダー</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">人が日付を探し、ジョブが正本を走査する。契約・債務・請求・報告・確定action itemを実日付で俯瞰する。</p>
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

      <section aria-label="カレンダーの状態" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border py-3 text-sm">
        <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /><span className="text-muted-foreground">生成済み</span><strong>{data.meta.generatedCount}</strong></span>
        <span className="inline-flex items-center gap-2"><CircleAlert className="h-4 w-4 text-amber-700" aria-hidden="true" /><span className="text-muted-foreground">根拠不足</span><strong>{data.meta.needsSourceCount}</strong></span>
        <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-sky-600" aria-hidden="true" /><span className="text-muted-foreground">鮮度・ルール確認</span><strong>{data.meta.staleOccurrenceCount + data.meta.staleRuleCount}</strong></span>
        <span className="ml-auto text-xs text-muted-foreground">{year}年 / {yearItems.length}件を表示</span>
      </section>

      <section className="overflow-hidden border border-border bg-card" aria-labelledby="annual-rail-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div><h2 id="annual-rail-title" className="font-semibold">年間締切レール</h2><p className="text-xs text-muted-foreground">月を押すと、実日付カレンダーへ移動</p></div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm"><span className="text-xs text-muted-foreground">対象年</span><select value={year} onChange={(event) => { const nextYear = Number(event.target.value); setYear(nextYear); setMobileMonth(1); setSelectedDate(null); }} className="bg-transparent font-semibold outline-none">{years.map((item) => <option key={item} value={item}>{item}年</option>)}</select></label>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <div className="relative grid grid-cols-6 gap-1 sm:grid-cols-6 lg:grid-cols-12">
            {monthKeys.map((key, index) => {
              const count = yearItems.filter((item) => itemMatchesMonth(item, key)).length;
              const urgent = yearItems.some((item) => itemMatchesMonth(item, key) && ["overdue", "due_today", "needs_source"].includes(item.computed_status));
              return <button type="button" key={key} onClick={() => focusMonth(index + 1)} className={`group relative min-h-12 rounded-lg border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[64px] sm:p-2 ${activeMonth === index + 1 ? "border-foreground bg-muted" : "border-border/70 bg-background hover:border-foreground/40"}`} aria-label={`${monthLabel(year, index + 1)}へ移動`}><span className="whitespace-nowrap text-[10px] font-semibold sm:text-xs">{index + 1}月</span><span className="mt-0.5 block text-lg font-semibold tracking-tight sm:text-xl">{count}</span><span className={`mt-1 block h-1 rounded-full ${urgent ? "bg-amber-500" : count ? "bg-sky-400" : "bg-muted"}`} /></button>;
            })}
            {todayYear === year && <span aria-hidden="true" className="pointer-events-none absolute -top-2 bottom-0 hidden w-px bg-foreground/70 sm:block" style={{ left: `${((Number(today.slice(5, 7)) - 0.5) / 12) * 100}%` }}><span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">今日</span></span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-rose-600" />期限超過</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" />要確認 / 今日</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-sky-400" />締切あり</span></div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 border border-border bg-card p-3" aria-label="表示フィルター">
        <span className="inline-flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />絞り込み</span>
        <FilterSelect label="カテゴリ" value={category} onChange={(value) => setCategory(value as ScheduleCategory | "all")} options={["all", ...categoryOptions]} labels={{ all: "すべて", ...CATEGORY_LABELS }} />
        <FilterSelect label="プロジェクト" value={projectId} onChange={setProjectId} options={["all", ...data.projects.map((item) => item.project_id)]} labels={{ all: "すべて", ...Object.fromEntries(data.projects.map((item) => [item.project_id, item.project_name])) }} />
        <FilterSelect label="担当" value={ownerId} onChange={setOwnerId} options={["all", ...data.members.map((item) => item.member_id)]} labels={{ all: "すべて", ...Object.fromEntries(data.members.map((item) => [item.member_id, item.member_name ?? item.code_name])) }} />
        <FilterSelect label="状態" value={status} onChange={(value) => setStatus(value as StatusFilter)} options={Object.keys(STATUS_LABELS) as StatusFilter[]} labels={STATUS_LABELS} />
        <span className="ml-auto px-1 text-xs text-muted-foreground">{visibleItems.length}件</span>
      </section>

      <section aria-labelledby="schedule-calendar-title" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div><h2 id="schedule-calendar-title" className="text-lg font-semibold">{year}年の実日付カレンダー</h2><p className="text-sm text-muted-foreground">月・曜日・日付を固定し、当日の締切から詳細へ進む。</p></div>
          <span className="hidden text-xs text-muted-foreground md:inline">月 火 水 木 金 土 日</span>
        </div>

        <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
          {monthList.map((item) => <CalendarMonth key={item.key} calendarMonth={item} items={yearItems} today={today} onSelectId={setSelectedId} onSelectDate={selectDate} onShowAgenda={setAgendaDate} />)}
        </div>

        <div className="space-y-3 md:hidden" data-testid="mobile-calendar">
          <div className="flex items-center gap-2 border border-border bg-card p-2">
            <button type="button" onClick={() => shiftMobileMonth(-1)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="前月"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
            <label className="flex min-w-0 flex-1 items-center justify-center gap-2 text-sm font-semibold"><span className="sr-only">表示月</span><select value={mobileMonth} onChange={(event) => setMobileCalendarMonth(Number(event.target.value))} className="min-w-0 max-w-full bg-transparent text-center outline-none">{monthList.map((item) => <option key={item.key} value={item.month}>{monthLabel(year, item.month)}</option>)}</select></label>
            <button type="button" onClick={() => shiftMobileMonth(1)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="次月"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
            <button type="button" onClick={goToToday} className="min-h-11 shrink-0 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">今日</button>
          </div>
          <CalendarMonth calendarMonth={{ year, month: mobileMonth, key: mobileKey }} items={yearItems} today={today} mobile selectedDate={mobileSelectedDate} onSelectId={setSelectedId} onSelectDate={selectDate} onShowAgenda={showAgenda} />
          <DayAgenda date={mobileSelectedDate} items={mobileAgendaItems} onSelect={setSelectedId} emptyLabel="日付を選ぶと、この日の締切がここに出るよ。" />
        </div>

        {agendaDate && <div className="hidden md:block"><DayAgenda date={agendaDate} items={desktopAgendaItems} onSelect={setSelectedId} /></div>}
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="カレンダー補助情報">
        <div className="border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">次に見る</h2><ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></div>
          <p className="mt-1 text-xs text-muted-foreground">未完了・根拠不足を近い順に表示</p>
          <div className="mt-3 space-y-1">{nearest.length ? nearest.map((item) => <ScheduleListItem key={item.occurrence_id} item={item} compact onSelect={setSelectedId} />) : <p className="py-5 text-sm text-muted-foreground">確認対象はないよ。</p>}</div>
        </div>
        <div className="border border-dashed border-border bg-muted/20 p-4">
          <p className="font-semibold">日付を生成できない締切</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">月自体も不明な予定は、架空の日へ置かずここで常時確認できる。</p>
          <div className="mt-3 space-y-1">{yearUnknownItems.length ? yearUnknownItems.map((item) => <ScheduleListItem key={item.occurrence_id} item={item} compact onSelect={setSelectedId} />) : <p className="py-4 text-sm text-muted-foreground">該当なし</p>}</div>
        </div>
      </section>

      <div className="border border-dashed border-border bg-muted/20 p-4 text-sm">
        <p className="font-semibold">正本を直す場所</p>
        <p className="mt-1 leading-6 text-muted-foreground">日付・金額・担当者の誤りは、契約・債務・請求・報告書・action item側を修正してから再生成してね。</p>
      </div>

      {selected && <DetailDrawer item={selected} onClose={() => setSelectedId(null)} actionBusy={actionBusy} actionReason={actionReason} evidenceRef={evidenceRef} onReasonChange={setActionReason} onEvidenceChange={setEvidenceRef} onAction={recordAction} />}
    </div>
  );
}

function CalendarMonth({ calendarMonth, items, today, mobile = false, selectedDate, onSelectId, onSelectDate, onShowAgenda }: { calendarMonth: CalendarMonth; items: ScheduleViewOccurrence[]; today: string; mobile?: boolean; selectedDate?: string | null; onSelectId: (id: string) => void; onSelectDate: (date: string) => void; onShowAgenda: (date: string) => void }) {
  const { year, month, key } = calendarMonth;
  const cells = buildMonthGrid(year, month);
  const monthItems = items.filter((item) => itemMatchesMonth(item, key));
  const datedItems = monthItems.filter((item) => isDatePrecisionDay(item) && item.due_on?.startsWith(`${year}-${String(month).padStart(2, "0")}-`));
  const undatedItems = monthItems.filter((item) => !isDatePrecisionDay(item));
  const cellSize = mobile ? "min-h-[58px]" : "min-h-[92px]";

  return (
    <section id={`schedule-month-${year}-${String(month).padStart(2, "0")}`} className="min-w-0 border border-border bg-card" aria-labelledby={`schedule-month-title-${key}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-3">
        <h3 id={`schedule-month-title-${key}`} className="text-base font-semibold">{monthLabel(year, month)}</h3>
        <span className="text-xs text-muted-foreground">{monthItems.length}件</span>
      </div>
      <div className="grid grid-cols-7 border-b border-border bg-muted/30" aria-hidden="true">
        {CALENDAR_WEEKDAYS.map((weekday, index) => <span key={weekday} className={`py-1.5 text-center text-[10px] font-semibold ${index >= 5 ? "text-muted-foreground" : "text-foreground/70"}`}>{weekday}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, index) => {
          const dateItems = cell.date ? datedItems.filter((item) => item.due_on === cell.date) : [];
          const shown = dateItems.slice(0, 3);
          const remainder = dateItems.length - shown.length;
          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          return <div key={cell.date ?? `outside-${index}`} className={`relative min-w-0 overflow-hidden border-b border-r border-border/70 p-1 ${cellSize} ${cell.outside ? "bg-muted/20" : cell.weekend ? "bg-muted/10" : "bg-card"} ${isToday ? "outline outline-2 -outline-offset-2 outline-amber-500" : ""} ${isSelected ? "bg-sky-50/60" : ""}`}>
            {cell.day && cell.date ? <button type="button" onClick={() => onSelectDate(cell.date ?? "")} className="flex min-h-7 w-full items-center gap-1 rounded px-1 text-left text-xs font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${cell.date}の締切`}><span>{cell.day}</span>{dateItems.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-foreground/50 md:hidden" />}</button> : <span className="block min-h-7" aria-hidden="true" />}
            <div className="space-y-0.5">
              {shown.map((item) => <EventPill key={item.occurrence_id} item={item} date={cell.date ?? ""} mobile={mobile} onSelect={() => onSelectId(item.occurrence_id)} />)}
              {remainder > 0 && <button type="button" onClick={() => onShowAgenda(cell.date ?? "")} className="flex min-h-7 w-full items-center rounded px-1 text-left text-[10px] font-semibold text-muted-foreground underline-offset-2 hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">ほか{remainder}件</button>}
            </div>
          </div>;
        })}
      </div>
      <div className="border-t border-border px-3 py-2">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">月内・日付未確定 {undatedItems.length}件</p>
        {undatedItems.length > 0 && <div className="mt-1 space-y-0.5">{undatedItems.slice(0, 2).map((item) => <button type="button" key={item.occurrence_id} onClick={() => onSelectId(item.occurrence_id)} className="flex min-h-8 w-full min-w-0 items-center gap-1.5 rounded px-1 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_STYLES[item.computed_status]}`} /><span className="min-w-0 flex-1 truncate">{shortTitle(item)}</span><span className="shrink-0 text-[10px] text-muted-foreground">{CATEGORY_LABELS[item.category]}</span></button>)}{undatedItems.length > 2 && <button type="button" onClick={() => onSelectId(undatedItems[2].occurrence_id)} className="min-h-8 px-1 text-xs font-semibold text-muted-foreground hover:underline">ほか{undatedItems.length - 2}件</button>}</div>}
      </div>
    </section>
  );
}

function EventPill({ item, date, mobile, onSelect }: { item: ScheduleViewOccurrence; date: string; mobile: boolean; onSelect: () => void }) {
  const amount = shortAmountLabel(item);
  return <button type="button" onClick={onSelect} title={item.title} aria-label={`${date} ${shortTitle(item)} ${stateLabel(item)}${amount ? ` ${amount}` : ""}`} className={`block min-h-7 w-full min-w-0 overflow-hidden rounded border border-transparent border-l-[3px] px-1.5 py-1 text-left text-[10px] font-semibold leading-tight transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${STATUS_STYLES[item.computed_status]}`}><span className="block truncate">{shortTitle(item)}</span>{!mobile && <span className="block truncate text-[9px] font-normal opacity-75">{amount ?? CATEGORY_LABELS[item.category]}</span>}</button>;
}

function DayAgenda({ date, items, onSelect, emptyLabel = "この日の締切はないよ。" }: { date: string | null; items: ScheduleViewOccurrence[]; onSelect: (id: string) => void; emptyLabel?: string }) {
  if (!date) return <div className="border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">{emptyLabel}</div>;
  return <section className="border border-border bg-card p-4" aria-labelledby="selected-day-agenda-title"><div className="flex items-baseline justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Selected date</p><h3 id="selected-day-agenda-title" className="mt-1 font-semibold">{formatDayAgendaHeading(date)}</h3></div><span className="text-xs text-muted-foreground">{items.length}件</span></div><div className="mt-3 space-y-1">{items.length ? items.map((item) => <ScheduleListItem key={item.occurrence_id} item={item} onSelect={onSelect} />) : <p className="py-4 text-sm text-muted-foreground">この日の締切はないよ。</p>}</div></section>;
}

function FilterSelect({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels: Record<string, string> }) {
  return <label className="flex h-10 min-w-[132px] items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs"><span className="text-muted-foreground">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none">{options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}</select></label>;
}

function ScheduleListItem({ item, onSelect, compact = false }: { item: ScheduleViewOccurrence; onSelect: (id: string) => void; compact?: boolean }) {
  const Icon = CATEGORY_ICONS[item.category] ?? CalendarDays;
  return <button type="button" onClick={() => onSelect(item.occurrence_id)} className={`group flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${compact ? "py-1.5" : "py-2"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border-l-[3px] ${STATUS_STYLES[item.computed_status]}`}><Icon className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{shortTitle(item)}</span>{item.computed_status === "needs_source" && <span className="shrink-0 text-[10px] font-semibold text-amber-700">要根拠</span>}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{dateLabel(item)} · {CATEGORY_LABELS[item.category]}</span></span><span className="hidden shrink-0 text-xs text-muted-foreground group-hover:block">詳細</span></button>;
}

function DetailDrawer({ item, onClose, actionBusy, actionReason, evidenceRef, onReasonChange, onEvidenceChange, onAction }: { item: ScheduleViewOccurrence; onClose: () => void; actionBusy: boolean; actionReason: string; evidenceRef: string; onReasonChange: (value: string) => void; onEvidenceChange: (value: string) => void; onAction: (action: "completed" | "not_applicable" | "reopened") => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 lg:items-stretch lg:justify-end" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="schedule-detail-title" className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl lg:max-h-none lg:w-[min(480px,100vw)] lg:rounded-none lg:border-y-0 lg:border-r-0"><header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Occurrence detail</p><h2 id="schedule-detail-title" className="mt-1 text-lg font-semibold leading-7">{item.title}</h2></div><button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="詳細を閉じる"><X className="h-5 w-5" aria-hidden="true" /></button></header><div className="min-h-0 flex-1 overflow-y-auto px-5 py-5"><div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${STATUS_STYLES[item.computed_status]}`}>{statusIcon(item.computed_status)}{stateLabel(item)}</div><div className="mt-5 space-y-4"><DetailRow label="期限" value={fullDateLabel(item)} /><DetailRow label="金額" value={amountLabel(item)} /><DetailRow label="担当" value={item.owner_label ?? "担当未確定"} /><DetailRow label="プロジェクト" value={item.project_label ?? "会社全体"} /><DetailRow label="生成状態" value={`${stateLabel(item)} / ${item.source_kind}${item.rule_version ? ` / ルール ${item.rule_version}` : ""}`} />{item.missing_reason && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">根拠が足りない理由</p><p className="mt-1 leading-6">{item.missing_reason}</p></div>}<SourceBlock item={item} /></div>{item.notification_owner !== "payment_obligation" && <div className="mt-6 border-t border-border pt-5"><h3 className="text-sm font-semibold">行動履歴を追加</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">日付・金額・担当者の変更ではなく、確認・完了の履歴だけを追記する。</p><label className="mt-3 block text-xs font-medium">理由<textarea value={actionReason} onChange={(event) => onReasonChange(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border bg-card p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="何を確認したか" /></label><label className="mt-3 block text-xs font-medium">根拠リンク / 参照先<input value={evidenceRef} onChange={(event) => onEvidenceChange(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="https://… または正本ID" /></label><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={actionBusy || (!actionReason.trim() && !evidenceRef.trim())} onClick={() => onAction("completed")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50"><Check className="h-4 w-4" aria-hidden="true" />完了にする</button><button type="button" disabled={actionBusy || (!actionReason.trim() && !evidenceRef.trim())} onClick={() => onAction("not_applicable")} className="min-h-11 rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-50">対象外</button></div>{item.latest_action && <button type="button" disabled={actionBusy} onClick={() => onAction("reopened")} className="mt-2 min-h-11 w-full rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-50">完了を取り消す（履歴を追記）</button>}</div>}</div></section></div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-b border-border/70 pb-3"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="min-w-0 text-sm leading-6">{value}</dd></div>;
}

function SourceBlock({ item }: { item: ScheduleViewOccurrence }) {
  const refs = Array.isArray(item.official_refs_json) ? item.official_refs_json : [];
  return <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs font-semibold text-muted-foreground">正本 / 根拠</p><div className="mt-2 space-y-2 text-sm"><p className="break-words font-mono text-xs text-muted-foreground">{item.source_kind}{item.source_id ? `:${item.source_id}` : ""}</p>{item.resolution_href && <Link href={item.resolution_href} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground underline underline-offset-4">正本を開く<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>}{refs.map((ref, index) => { const record = ref as { label?: string; url?: string; asOf?: string }; if (!record.url) return null; return <a key={`${record.url}-${index}`} href={record.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground underline underline-offset-4"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{record.label ?? "公式ルール"}（確認日 {record.asOf ?? "未設定"}）</a>; })}</div></div>;
}
