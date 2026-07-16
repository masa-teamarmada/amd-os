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
  ChevronDown,
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
import { todayJst } from "@/lib/admin-schedule/date";
import type {
  AmountRole,
  ScheduleCategory,
  ScheduleViewData,
  ScheduleViewOccurrence,
} from "@/lib/admin-schedule/types";

type Props = { initialData: ScheduleViewData };
type StatusFilter = "all" | ScheduleViewOccurrence["computed_status"];

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
  overdue: "border-red-200 bg-red-50 text-red-800",
  due_today: "border-orange-200 bg-orange-50 text-orange-800",
  due_soon: "border-amber-200 bg-amber-50 text-amber-900",
  open: "border-sky-200 bg-sky-50 text-sky-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-border bg-muted text-muted-foreground",
  needs_source: "border-amber-300 bg-amber-50 text-amber-950",
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

function amountLabel(item: ScheduleViewOccurrence): string {
  if (item.amount_status === "not_applicable") return "金額なし";
  if (item.amount_yen == null || item.amount_status === "unknown") return "金額未確定";
  const prefix = item.amount_status === "estimated" ? "概算 " : "";
  return `${prefix}¥${item.amount_yen.toLocaleString("ja-JP")} / ${amountRoleLabel(item.amount_role)}`;
}

function amountRoleLabel(role: AmountRole): string {
  if (role === "outgoing") return "支出";
  if (role === "incoming") return "入金";
  if (role === "contract_reference") return "契約参照額";
  return "情報";
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

export function AdminScheduleClient({ initialData }: Props) {
  const [data] = useState(initialData);
  const [year, setYear] = useState(Number(initialData.from.slice(0, 4)));
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState<ScheduleCategory | "all">("all");
  const [projectId, setProjectId] = useState("all");
  const [ownerId, setOwnerId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [mobileOpenMonth, setMobileOpenMonth] = useState<string | null>(null);
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
  const today = todayJst();
  const todayYear = Number(today.slice(0, 4));
  const monthKeys = Array.from({ length: 12 }, (_, index) => monthKey(year, index + 1));
  const firstPopulatedMonthIndex = monthKeys.findIndex((key) => yearItems.some((item) => itemMatchesMonth(item, key)));
  const nearest = yearItems.filter((item) => item.computed_status !== "completed" && item.computed_status !== "cancelled").slice(0, 6);
  const categoryOptions = [...new Set(data.occurrences.map((item) => item.category))].sort();
  const years = [...new Set([Number(initialData.from.slice(0, 4)), Number(initialData.to.slice(0, 4)), todayYear])].sort();

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
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-foreground text-background shadow-sm">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin / Operations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">運営カレンダー</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">契約・債務・請求・報告書・確定action itemの正本から、今年の締切を自動で俯瞰する。</p>
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

      <section aria-label="カレンダーの状態" className="grid gap-2 sm:grid-cols-3">
        <StateStrip icon={<CheckCircle2 className="h-4 w-4" />} label="生成済み" value={data.meta.generatedCount} tone="green" />
        <StateStrip icon={<CircleAlert className="h-4 w-4" />} label="根拠不足" value={data.meta.needsSourceCount} tone="amber" />
        <StateStrip icon={<Clock3 className="h-4 w-4" />} label="鮮度・ルール確認" value={data.meta.staleOccurrenceCount + data.meta.staleRuleCount} tone="blue" />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-labelledby="annual-rail-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div><h2 id="annual-rail-title" className="font-semibold">年間締切レール</h2><p className="text-xs text-muted-foreground">期限の密度と、いちばん近い月を先に見る</p></div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm"><span className="text-xs text-muted-foreground">対象年</span><select value={year} onChange={(event) => setYear(Number(event.target.value))} className="bg-transparent font-semibold outline-none">{years.map((item) => <option key={item} value={item}>{item}年</option>)}</select></label>
        </div>
        <div className="px-4 py-5 sm:px-5">
          <div className="relative grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-12">
            {monthKeys.map((key, index) => {
              const count = yearItems.filter((item) => itemMatchesMonth(item, key)).length;
              const urgent = yearItems.some((item) => itemMatchesMonth(item, key) && ["overdue", "due_today", "needs_source"].includes(item.computed_status));
              return <button type="button" key={key} onClick={() => { setActiveMonth(index + 1); setMobileOpenMonth(key); }} className={`group relative min-h-[76px] rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeMonth === index + 1 ? "border-foreground bg-muted" : "border-border/70 bg-background hover:border-foreground/40"}`} aria-label={`${monthLabel(year, index + 1)}を表示`}><span className="text-xs font-semibold">{index + 1}月</span><span className="mt-2 block text-2xl font-semibold tracking-tight">{count}</span><span className={`mt-1 block h-1 rounded-full ${urgent ? "bg-amber-500" : count ? "bg-sky-400" : "bg-muted"}`} /></button>;
            })}
            {todayYear === year && <span aria-hidden="true" className="pointer-events-none absolute -top-2 bottom-0 w-px bg-foreground/70" style={{ left: `${((Number(today.slice(5, 7)) - 0.5) / 12) * 100}%` }}><span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">今日</span></span>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" />要確認 / 期限超過</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-sky-400" />締切あり</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-muted" />該当なし</span></div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm" aria-label="表示フィルター">
        <span className="inline-flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />絞り込み</span>
        <FilterSelect label="カテゴリ" value={category} onChange={(value) => setCategory(value as ScheduleCategory | "all")} options={["all", ...categoryOptions]} labels={{ all: "すべて", ...CATEGORY_LABELS }} />
        <FilterSelect label="プロジェクト" value={projectId} onChange={setProjectId} options={["all", ...data.projects.map((item) => item.project_id)]} labels={{ all: "すべて", ...Object.fromEntries(data.projects.map((item) => [item.project_id, item.project_name])) }} />
        <FilterSelect label="担当" value={ownerId} onChange={setOwnerId} options={["all", ...data.members.map((item) => item.member_id)]} labels={{ all: "すべて", ...Object.fromEntries(data.members.map((item) => [item.member_id, item.member_name ?? item.code_name])) }} />
        <FilterSelect label="状態" value={status} onChange={(value) => setStatus(value as StatusFilter)} options={Object.keys(STATUS_LABELS) as StatusFilter[]} labels={STATUS_LABELS} />
        <span className="ml-auto px-1 text-xs text-muted-foreground">{visibleItems.length}件</span>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">{year}年の締切</h2><p className="text-sm text-muted-foreground">デスクトップは月の並びで、モバイルは月ごとのリストで確認できる。</p></div></div>
          <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {monthKeys.map((key, index) => <MonthCard key={key} title={monthLabel(year, index + 1)} items={yearItems.filter((item) => itemMatchesMonth(item, key))} onSelect={setSelectedId} />)}
          </div>
          <div className="space-y-2 sm:hidden">
            {monthKeys.map((key, index) => {
              const items = yearItems.filter((item) => itemMatchesMonth(item, key));
              const open = mobileOpenMonth === key || (mobileOpenMonth === null && index === firstPopulatedMonthIndex);
              return <div key={key} className="overflow-hidden rounded-xl border border-border bg-card"><button type="button" onClick={() => setMobileOpenMonth(open ? null : key)} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left" aria-expanded={open}><span className="font-semibold">{monthLabel(year, index + 1)}</span><span className="ml-auto text-xs text-muted-foreground">{items.length}件</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" /></button>{open && <div className="border-t border-border p-2">{items.length ? items.map((item) => <ScheduleListItem key={item.occurrence_id} item={item} onSelect={setSelectedId} />) : <p className="px-3 py-5 text-sm text-muted-foreground">この月の締切はないよ。</p>}</div>}</div>;
            })}
          </div>
        </div>
        <aside className="space-y-3 xl:pt-1">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">次に見る</h2><ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></div><p className="mt-1 text-xs text-muted-foreground">未完了・根拠不足を近い順に表示</p><div className="mt-3 space-y-1">{nearest.length ? nearest.map((item) => <ScheduleListItem key={item.occurrence_id} item={item} compact onSelect={setSelectedId} />) : <p className="py-5 text-sm text-muted-foreground">確認対象はないよ。</p>}</div></div>
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm"><p className="font-semibold">正本を直す場所</p><p className="mt-1 leading-6 text-muted-foreground">日付・金額・担当者の誤りは、契約・債務・請求・報告書・action item側を修正してから再生成してね。</p></div>
        </aside>
      </section>

      {selected && <DetailDrawer item={selected} onClose={() => setSelectedId(null)} actionBusy={actionBusy} actionReason={actionReason} evidenceRef={evidenceRef} onReasonChange={setActionReason} onEvidenceChange={setEvidenceRef} onAction={recordAction} />}
    </div>
  );
}

function StateStrip({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "green" | "amber" | "blue" }) {
  const style = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-800";
  return <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${style}`}><span>{icon}</span><span className="text-sm font-medium">{label}</span><span className="ml-auto text-xl font-semibold">{value}</span></div>;
}

function FilterSelect({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels: Record<string, string> }) {
  return <label className="flex h-10 min-w-[132px] items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs"><span className="text-muted-foreground">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none">{options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}</select></label>;
}

function MonthCard({ title, items, onSelect }: { title: string; items: ScheduleViewOccurrence[]; onSelect: (id: string) => void }) {
  const shown = items.slice(0, 4);
  return <section className="min-h-[180px] rounded-xl border border-border bg-card p-3 shadow-sm"><div className="flex items-center justify-between gap-2 border-b border-border pb-2"><h3 className="text-sm font-semibold">{title}</h3><span className="text-xs text-muted-foreground">{items.length}件</span></div><div className="mt-2 space-y-1">{shown.map((item) => <ScheduleListItem key={item.occurrence_id} item={item} compact onSelect={onSelect} />)}{items.length > shown.length && <p className="px-2 py-2 text-xs text-muted-foreground">ほか {items.length - shown.length}件</p>}{items.length === 0 && <p className="px-2 py-5 text-xs text-muted-foreground">締切なし</p>}</div></section>;
}

function ScheduleListItem({ item, onSelect, compact = false }: { item: ScheduleViewOccurrence; onSelect: (id: string) => void; compact?: boolean }) {
  const Icon = CATEGORY_ICONS[item.category] ?? CalendarDays;
  return <button type="button" onClick={() => onSelect(item.occurrence_id)} className={`group flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${compact ? "py-1.5" : "py-2"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${STATUS_STYLES[item.computed_status]}`}><Icon className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{shortTitle(item)}</span>{item.computed_status === "needs_source" && <span className="shrink-0 text-[10px] font-semibold text-amber-700">要根拠</span>}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{dateLabel(item)} · {CATEGORY_LABELS[item.category]}</span></span><span className="hidden shrink-0 text-xs text-muted-foreground group-hover:block">詳細</span></button>;
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
