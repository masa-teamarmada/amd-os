"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  Calculator,
  Check,
  Download,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  HOLDER_COLORS,
  HOLDER_LABELS,
  TRANSACTION_LABELS,
  buildCapTableSnapshots,
  capTableOriginWarning,
  capTableTieOut,
  computeNextRoundScenario,
  convertibleScenario,
  minimumPreMoneyForTarget,
  nextRoundSensitivity,
  type CapTableSnapshot,
  type CompanyOverviewData,
  type NextRoundInputs,
  type NextRoundScenarioResult,
  type ValuationRound,
} from "@/lib/company-overview";
import { downloadCompanyOverviewXlsx } from "@/lib/company-overview-xlsx";

type DialogKind = "profile" | "equity" | "round" | "convertible" | "financial" | "meeting" | null;

const EMPTY_DATA: CompanyOverviewData = {
  profile: null,
  shareholders: [],
  transactions: [],
  convertibles: [],
  financialPeriods: [],
  rounds: [],
  meetings: [],
  actionItems: [],
};

const LEGAL_STATUS = [
  { value: "pre_incorporation", label: "設立前" },
  { value: "incorporated", label: "設立済み" },
  { value: "liquidating", label: "清算中" },
  { value: "closed", label: "清算済み" },
];
const HOLDER_TYPES = Object.entries(HOLDER_LABELS).map(([value, label]) => ({ value, label }));
const TRANSACTION_TYPES = ["incorporation", "opening_balance", "new_issue", "transfer", "stock_option_grant", "stock_option_exercise", "in_kind_contribution", "cancellation", "correction"]
  .map((value) => ({ value, label: TRANSACTION_LABELS[value] }));
const MEETING_TYPES = [
  { value: "agm", label: "定時株主総会" },
  { value: "egm", label: "臨時株主総会" },
  { value: "board", label: "取締役会" },
  { value: "board_written", label: "取締役会（書面決議）" },
  { value: "shareholder_written", label: "株主総会（書面決議）" },
];

function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value || "").replaceAll(",", "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function textOrNull(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

function formatYen(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  if (Math.abs(number) >= 100_000_000) return `${(number / 100_000_000).toLocaleString("ja-JP", { maximumFractionDigits: 2 })}億円`;
  if (Math.abs(number) >= 10_000) return `${(number / 10_000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万円`;
  return `${number.toLocaleString("ja-JP")}円`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "日付未入力";
  return value.replaceAll("-", "/");
}

function compactCorporateNumber(value: string | null | undefined) {
  if (!value) return "未入力";
  return value.replace(/^(\d)(\d{4})(\d{4})(\d{4})$/, "$1-$2-$3-$4");
}

function meetingLabel(value: string | null | undefined) {
  return MEETING_TYPES.find((option) => option.value === value)?.label || value || "種別未入力";
}

function statusLabel(value: string | null | undefined) {
  return ({ draft: "下書き", final: "確定", filed: "申告済み", planned: "計画", confirmed: "確定", void: "取消" } as Record<string, string>)[value || ""] || value || "未入力";
}

function sourceHref(attachment: { url?: string; webViewLink?: string; web_view_link?: string }) {
  return attachment.url || attachment.webViewLink || attachment.web_view_link || "";
}

function Section({ title, description, action, children, className = "" }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:px-5" data-section-header="mobile-stack-sm-row">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">{title}</h2>
          {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
        </div>
        {action && <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0" data-html2canvas-ignore="true">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function InfoCell({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:px-5 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-900">{value || <span className="text-slate-400">未入力</span>}</div>
    </div>
  );
}

function Field({ label, name, children, hint }: { label: string; name?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs text-slate-700">{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-4 text-slate-500">{hint}</p>}
    </div>
  );
}

function NativeSelect({ name, defaultValue, options, className = "" }: { name: string; defaultValue?: string; options: { value: string; label: string }[]; className?: string }) {
  const [value, setValue] = useState(defaultValue || options[0]?.value || "");
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Select value={value} onValueChange={(next) => setValue(next || "")}>
        <SelectTrigger className={`h-11 w-full bg-white ${className}`}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-5 py-8 text-center text-sm leading-6 text-slate-500">{children}</div>;
}

const HOLDER_NAME_PALETTE = [
  "#1d4ed8", "#0d9488", "#7c3aed", "#d97706", "#dc2626",
  "#0284c7", "#65a30d", "#c026d3", "#ea580c", "#0f766e",
  "#4338ca", "#b91c1c", "#059669", "#a16207", "#475569",
];

function buildHolderColorMap(snapshots: CapTableSnapshot[]): Map<string, string> {
  const order: string[] = [];
  const seen = new Set<string>();
  const addFrom = (snapshot: CapTableSnapshot) => {
    for (const holder of aggregateByHolderName(snapshot, true)) {
      if (!seen.has(holder.holderName)) {
        seen.add(holder.holderName);
        order.push(holder.holderName);
      }
    }
  };
  const latest = snapshots.at(-1);
  if (latest) addFrom(latest);
  for (const snapshot of snapshots) addFrom(snapshot);
  const map = new Map<string, string>();
  order.forEach((name, index) => map.set(name, HOLDER_NAME_PALETTE[index % HOLDER_NAME_PALETTE.length]));
  return map;
}

function aggregateByHolderName(snapshot: CapTableSnapshot, diluted = false) {
  const totals = new Map<string, { holderName: string; holderType: string; shares: number }>();
  for (const row of snapshot.rows) {
    const shares = diluted ? row.dilutedShares : row.outstandingShares;
    const current = totals.get(row.holderName) || { holderName: row.holderName, holderType: row.holderType, shares: 0 };
    totals.set(row.holderName, { ...current, shares: current.shares + shares });
  }
  const total = diluted ? snapshot.dilutedShares : snapshot.outstandingShares;
  return [...totals.values()]
    .filter((item) => Math.abs(item.shares) > 0.000001)
    .map((item) => ({ ...item, pct: total > 0 ? (item.shares / total) * 100 : 0 }))
    .sort((a, b) => b.shares - a.shares);
}

function CapTableOriginWarning({ onAddFoundingEvent }: { onAddFoundingEvent: () => void }) {
  return (
    <div data-cap-table-origin-warning className="mx-4 mb-3 flex flex-wrap items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:mx-5">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">履歴の起点が創業時ではないよ</p>
        <p className="mt-1 leading-5 text-amber-800">現在値は見られるけど、創業からの希薄化の推移はこの履歴だけでは復元できないよ。</p>
      </div>
      <Button type="button" variant="outline" className="h-11 border-amber-300 bg-white text-amber-900 hover:bg-amber-100" onClick={onAddFoundingEvent}><Plus />創業時の株式イベントを追加</Button>
    </div>
  );
}

type NextRoundScenarioRowLike = {
  key: string;
  holderName: string;
  holderType: string;
  beforeShares: number;
  beforePct: number;
  afterShares: number;
  afterPct: number;
  isConvertible?: boolean;
  isNewInvestor?: boolean;
  isOptionPool?: boolean;
  isProtected?: boolean;
};

function scenarioRowColor(row: NextRoundScenarioRowLike, colorMap: Map<string, string>) {
  if (row.isNewInvestor) return "#0ea5e9";
  if (row.isOptionPool) return "#8b5cf6";
  if (row.isConvertible) return "#f59e0b";
  return colorMap.get(row.holderName) || HOLDER_COLORS[row.holderType] || HOLDER_COLORS.other;
}

function EventOwnershipBar({ label, holders, emptyLabel = "—" }: { label: string; holders: { holderName: string; pct: number; color: string }[]; emptyLabel?: string }) {
  const total = holders.reduce((sum, holder) => sum + holder.pct, 0);
  if (!holders.length || total <= 0) {
    return <div role="img" aria-label={`${label}：${emptyLabel}`} className="flex h-28 items-center justify-center rounded-[2px] bg-slate-100 text-center text-[10px] leading-4 text-slate-400 sm:h-32">{emptyLabel}</div>;
  }
  const ariaLabel = `${label}：${holders.map((holder) => `${holder.holderName} ${holder.pct.toFixed(1)}%`).join("、")}`;
  return (
    <div className="relative h-28 w-full overflow-hidden rounded-[2px] bg-slate-100 sm:h-32" role="img" aria-label={ariaLabel}>
      <div className="absolute inset-0 flex flex-col-reverse">
        {holders.map((holder) => <span key={holder.holderName} className="w-full" style={{ height: `${holder.pct}%`, backgroundColor: holder.color }} />)}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-white/70" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-white/70" />
      <div className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-white/70" />
    </div>
  );
}

function MatrixMetaRow({ label, values, scenarioValue, snapshots, baseId }: { label: string; values: string[]; scenarioValue: string; snapshots: CapTableSnapshot[]; baseId: string }) {
  return (
    <tr>
      <td className="sticky left-0 z-10 border-r border-slate-100 bg-slate-50 px-3 py-2 font-medium text-slate-500">{label}</td>
      {snapshots.map((snapshot, index) => (
        <td key={snapshot.id} className={`px-1.5 py-2 text-right tabular-nums text-slate-600 ${snapshot.id === baseId ? "bg-slate-50" : ""}`}>{values[index]}</td>
      ))}
      <td className="border-l border-dashed border-blue-300 bg-blue-50/40 px-1.5 py-2 text-right tabular-nums text-blue-900">{scenarioValue}</td>
    </tr>
  );
}

function CapitalPolicyWorkspace({
  data,
  snapshots,
  rounds,
  colorMap,
  baseId,
  onSelectBase,
  originWarning,
  onAddFoundingEvent,
}: {
  data: CompanyOverviewData;
  snapshots: CapTableSnapshot[];
  rounds: ValuationRound[];
  colorMap: Map<string, string>;
  baseId: string;
  onSelectBase: (id: string) => void;
  originWarning: boolean;
  onAddFoundingEvent: () => void;
}) {
  const latestSnapshot = snapshots.at(-1) || null;
  const [preMoney, setPreMoney] = useState<number | "">(() => {
    const sortedRounds = [...data.rounds].sort((a, b) => (b.round_date || b.round_ym || "").localeCompare(a.round_date || a.round_ym || ""));
    const preFromRound = sortedRounds.find((round) => round.pre_money_yen != null)?.pre_money_yen;
    const preFallback = Math.max(500_000_000, Math.round(((latestSnapshot?.paidInYen) || 0) * 10));
    return preFromRound ?? preFallback;
  });
  const [raise, setRaise] = useState<number | "">(() => {
    const sortedRounds = [...data.rounds].sort((a, b) => (b.round_date || b.round_ym || "").localeCompare(a.round_date || a.round_ym || ""));
    return sortedRounds[0]?.raised_yen ?? 100_000_000;
  });
  const [poolPct, setPoolPct] = useState<number | "">(0);
  const [includeConvertibles, setIncludeConvertibles] = useState(true);
  const [protectHolder, setProtectHolder] = useState(() => {
    if (!latestSnapshot) return "";
    const founderRows = latestSnapshot.rows.filter((row) => row.holderType === "founder");
    const candidates = aggregateByHolderName(latestSnapshot, true).filter((holder) => (founderRows.length ? founderRows.some((row) => row.holderName === holder.holderName) : true));
    const topHolder = candidates[0] || aggregateByHolderName(latestSnapshot, true)[0];
    return topHolder?.holderName || "";
  });
  const [targetMinPct, setTargetMinPct] = useState<number | "">(() => {
    if (!latestSnapshot) return "";
    const founderRows = latestSnapshot.rows.filter((row) => row.holderType === "founder");
    const candidates = aggregateByHolderName(latestSnapshot, true).filter((holder) => (founderRows.length ? founderRows.some((row) => row.holderName === holder.holderName) : true));
    const topHolder = candidates[0] || aggregateByHolderName(latestSnapshot, true)[0];
    return topHolder ? Math.min(99, Math.max(1, Math.round((topHolder.pct - 5) * 10) / 10)) : "";
  });

  if (!latestSnapshot) {
    return (
      <Section title="資本政策" description="創業からの推移と次回ラウンド試算を同じ画面で見られるよ">
        <EmptyState>株式イベントを追加すると、資本政策の推移と次回ラウンド試算がここに出るよ。</EmptyState>
      </Section>
    );
  }

  const snapshot = snapshots.find((item) => item.id === baseId) || latestSnapshot;
  const input: NextRoundInputs = {
    preMoneyYen: Number(preMoney) || 0,
    raiseYen: Number(raise) || 0,
    targetPoolRate: (Number(poolPct) || 0) / 100,
    includeConvertibles,
    protectHolderName: protectHolder || null,
  };
  const result: NextRoundScenarioResult | null = computeNextRoundScenario(snapshot, data.convertibles, input);
  const minPre = protectHolder && Number(targetMinPct) > 0
    ? minimumPreMoneyForTarget(snapshot, data.convertibles, input, Number(targetMinPct))
    : null;
  const sensitivity = nextRoundSensitivity(snapshot, data.convertibles, input);
  const currentPct = protectHolder ? aggregateByHolderName(snapshot, true).find((holder) => holder.holderName === protectHolder)?.pct ?? null : null;
  const afterPct = result?.valid ? result.rows.find((row) => row.holderName === protectHolder)?.afterPct ?? null : null;
  const holderOptions = aggregateByHolderName(snapshot, true).map((holder) => holder.holderName);

  const holderOrder: string[] = [];
  const seen = new Set<string>();
  for (const item of [...snapshots].reverse()) {
    for (const holder of aggregateByHolderName(item)) {
      if (!seen.has(holder.holderName)) { seen.add(holder.holderName); holderOrder.push(holder.holderName); }
    }
  }
  if (result?.valid) {
    for (const row of result.rows) {
      if (!seen.has(row.holderName)) { seen.add(row.holderName); holderOrder.push(row.holderName); }
    }
  }

  function colorOf(holderName: string) {
    const scenarioRow = result?.valid ? result.rows.find((row) => row.holderName === holderName) : undefined;
    if (scenarioRow) return scenarioRowColor(scenarioRow, colorMap);
    return colorMap.get(holderName) || HOLDER_COLORS.other;
  }

  const LABEL_COL_WIDTH = 128;
  const EVENT_COL_WIDTH = 140;
  const SCENARIO_COL_WIDTH = 156;
  const tableWidth = LABEL_COL_WIDTH + snapshots.length * EVENT_COL_WIDTH + SCENARIO_COL_WIDTH;
  const baselineLabel = `${formatDate(snapshot.effectiveOn)} ${snapshot.label} 基準`;

  return (
    <Section title="資本政策" description="創業からの推移と次回ラウンド試算を同じ画面で。列見出しをクリックすると試算の基準にできるよ">
      {originWarning && <CapTableOriginWarning onAddFoundingEvent={onAddFoundingEvent} />}
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_272px] lg:items-start lg:gap-5">
        <div className="order-2 min-w-0 lg:order-1">
          <div data-testid="cap-table-history-matrix" className="overflow-x-auto rounded-md border border-slate-200">
            <table className="table-fixed border-collapse text-[11px]" style={{ width: tableWidth }}>
              <colgroup>
                <col style={{ width: LABEL_COL_WIDTH }} />
                {snapshots.map((s) => <col key={s.id} style={{ width: EVENT_COL_WIDTH }} />)}
                <col style={{ width: SCENARIO_COL_WIDTH }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left align-bottom font-medium text-slate-500">資本政策</th>
                  {snapshots.map((s) => {
                    const selected = s.id === baseId;
                    const eventLabel = `${formatDate(s.effectiveOn)} ${s.label}`;
                    return (
                      <th key={s.id} className={`border-b px-1.5 py-2 align-bottom ${selected ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
                        <button
                          type="button"
                          onClick={() => onSelectBase(s.id)}
                          aria-pressed={selected}
                          title={eventLabel}
                          aria-label={`${eventLabel}を試算の基準にする`}
                          className={`flex min-h-11 w-full flex-col justify-center border-b-2 px-1 pb-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:min-h-9 ${selected ? "border-slate-900" : "border-transparent hover:border-slate-300"}`}
                        >
                          <div className="truncate text-[10px] tabular-nums text-slate-500">{formatDate(s.effectiveOn)}</div>
                          <div className="truncate text-[11px] font-semibold text-slate-900">{s.label}</div>
                        </button>
                      </th>
                    );
                  })}
                  <th className="border-b border-l border-dashed border-blue-300 bg-blue-50/60 px-1.5 py-2 align-bottom" title={`${baselineLabel} / 仮・FD / 次回ラウンド（試算）`} aria-label={`${baselineLabel} 仮・FD 次回ラウンド（試算）`}>
                    <div className="px-1 pb-1">
                      <div className="truncate text-[10px] font-medium text-blue-600">{baselineLabel} 仮・FD</div>
                      <div className="truncate text-[11px] font-semibold text-blue-900">次回ラウンド（試算）</div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-2 text-slate-400">構成</td>
                  {snapshots.map((s) => (
                    <td key={s.id} className={`px-1.5 py-2 ${s.id === baseId ? "bg-slate-50" : ""}`}>
                      <EventOwnershipBar label={`${formatDate(s.effectiveOn)} ${s.label}`} holders={aggregateByHolderName(s).map((holder) => ({ holderName: holder.holderName, pct: holder.pct, color: colorOf(holder.holderName) }))} />
                    </td>
                  ))}
                  <td className="border-l border-dashed border-blue-300 bg-blue-50/40 px-1.5 py-2">
                    {result?.valid ? (
                      <EventOwnershipBar label="仮定の次回ラウンドFDシナリオ" holders={result.rows.filter((row) => row.afterShares > 0).map((row) => ({ holderName: row.holderName, pct: row.afterPct, color: scenarioRowColor(row, colorMap) }))} />
                    ) : (
                      <EventOwnershipBar label="仮定の次回ラウンドFDシナリオ" holders={[]} emptyLabel={result?.error || "算出不可"} />
                    )}
                  </td>
                </tr>

                <MatrixMetaRow label="発行済株式" snapshots={snapshots} baseId={baseId}
                  values={snapshots.map((s) => `${formatNumber(s.outstandingShares, 2)}株`)}
                  scenarioValue={result?.valid ? `FD ${formatNumber(result.postFdShares, 2)}株` : "—"} />
                <MatrixMetaRow label="新規発行株式" snapshots={snapshots} baseId={baseId}
                  values={snapshots.map((s) => (s.outstandingDelta ? `${s.outstandingDelta > 0 ? "+" : ""}${formatNumber(s.outstandingDelta, 2)}株` : "—"))}
                  scenarioValue={result?.valid ? `新規投資家 +${formatNumber(result.newInvestorShares, 2)}株` : "—"} />
                <MatrixMetaRow label="払込・調達額" snapshots={snapshots} baseId={baseId}
                  values={snapshots.map((s) => (s.paidInYenDelta ? formatYen(s.paidInYenDelta) : "—"))}
                  scenarioValue={result?.valid ? formatYen(input.raiseYen) : "—"} />
                <MatrixMetaRow label="発行価額" snapshots={snapshots} baseId={baseId}
                  values={snapshots.map((s) => {
                    const round = rounds.find((item) => item.id === s.roundId);
                    const price = round?.price_per_share_yen ?? (s.outstandingDelta > 0 ? s.paidInYenDelta / s.outstandingDelta : null);
                    return price ? formatYen(price) : "—";
                  })}
                  scenarioValue={result?.valid ? formatYen(result.issuePriceYen) : "—"} />
                <MatrixMetaRow label="pre-money" snapshots={snapshots} baseId={baseId}
                  values={snapshots.map((s) => { const round = rounds.find((item) => item.id === s.roundId); return round?.pre_money_yen != null ? formatYen(round.pre_money_yen) : "—"; })}
                  scenarioValue={result?.valid ? formatYen(input.preMoneyYen) : "—"} />
                <MatrixMetaRow label="post-money" snapshots={snapshots} baseId={baseId}
                  values={snapshots.map((s) => { const round = rounds.find((item) => item.id === s.roundId); return round?.post_money_yen != null ? formatYen(round.post_money_yen) : "—"; })}
                  scenarioValue={result?.valid ? formatYen(result.postMoneyYen) : "—"} />

                {holderOrder.map((holderName) => {
                  const scenarioRow = result?.valid ? result.rows.find((row) => row.holderName === holderName) : null;
                  return (
                    <tr key={holderName}>
                      <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-2 font-medium text-slate-900">
                        <span className="flex items-center gap-1.5 truncate"><span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: colorOf(holderName) }} /><span className="truncate">{holderName}</span></span>
                      </td>
                      {snapshots.map((s) => {
                        const holder = aggregateByHolderName(s).find((item) => item.holderName === holderName);
                        return (
                          <td key={s.id} className={`px-1.5 py-2 text-right tabular-nums ${s.id === baseId ? "bg-slate-50" : ""}`}>
                            {holder ? `${formatNumber(holder.shares, 2)}株 · ${holder.pct.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="border-l border-dashed border-blue-300 bg-blue-50/40 px-1.5 py-2 text-right tabular-nums text-blue-900">
                        {scenarioRow ? `${formatNumber(scenarioRow.afterShares, 2)}株 · ${scenarioRow.afterPct.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div data-testid="next-round-simulator" className="order-1 space-y-3 rounded-md border border-blue-100 bg-blue-50/30 p-3 lg:order-2 lg:sticky lg:top-4">
          <div className="flex items-start gap-2 rounded border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] leading-5 text-blue-900">
            <Calculator className="mt-0.5 size-3.5 shrink-0 text-blue-600" />
            <p>仮定の試算だよ。保存されないし、法的な現在値のcap tableには反映されないから、実行前にチームで確認してね。</p>
          </div>

          <div className="space-y-2">
            <Field label="基準にする時点">
              <Select value={baseId} onValueChange={(next) => onSelectBase(next || "")}>
                <SelectTrigger className="h-11 w-full bg-white text-[11px] sm:h-9">
                  <SelectValue>{(value: string) => {
                    const item = snapshots.find((s) => s.id === value);
                    return item ? `${formatDate(item.effectiveOn)} ${item.label}` : null;
                  }}</SelectValue>
                </SelectTrigger>
                <SelectContent>{snapshots.map((s) => <SelectItem key={s.id} value={s.id}>{formatDate(s.effectiveOn)} {s.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="守りたい株主">
              <Select value={protectHolder} onValueChange={(next) => setProtectHolder(next || "")}>
                <SelectTrigger className="h-11 w-full bg-white text-[11px] sm:h-9"><SelectValue placeholder="株主を選んでね" /></SelectTrigger>
                <SelectContent>{holderOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="pre-money（円）"><Input type="number" step={1_000_000} className="h-11 bg-white text-[11px] sm:h-9" value={preMoney} onChange={(event) => setPreMoney(event.target.value === "" ? "" : Number(event.target.value))} /></Field>
              <Field label="調達額（円）"><Input type="number" step={1_000_000} className="h-11 bg-white text-[11px] sm:h-9" value={raise} onChange={(event) => setRaise(event.target.value === "" ? "" : Number(event.target.value))} /></Field>
              <Field label="追加SOプール（%）"><Input type="number" step={0.1} min={0} max={50} className="h-11 bg-white text-[11px] sm:h-9" value={poolPct} onChange={(event) => setPoolPct(event.target.value === "" ? "" : Number(event.target.value))} /></Field>
              <Field label="守りたい最低比率（%）"><Input type="number" step={0.1} min={0} max={100} className="h-11 bg-white text-[11px] sm:h-9" value={targetMinPct} onChange={(event) => setTargetMinPct(event.target.value === "" ? "" : Number(event.target.value))} /></Field>
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700 sm:min-h-8">
              <input type="checkbox" className="size-3.5 accent-blue-600" checked={includeConvertibles} onChange={(event) => setIncludeConvertibles(event.target.checked)} />
              転換前証券の転換見込を含めて計算する
            </label>
          </div>

          <dl className="divide-y divide-slate-200 border-y border-slate-200 text-[11px]">
            <div className="flex items-center justify-between gap-2 py-1.5"><dt className="text-slate-500">{protectHolder || "対象株主"}の比率</dt><dd className="font-semibold tabular-nums text-slate-950">{currentPct?.toFixed(1) ?? "—"}% → {afterPct?.toFixed(1) ?? "—"}%</dd></div>
            <div className="flex items-center justify-between gap-2 py-1.5"><dt className="text-slate-500">維持できる最低pre-money</dt><dd className="text-right font-semibold tabular-nums text-slate-950">{minPre?.valid ? formatYen(minPre.preMoneyYen) : <span className="text-[10px] font-normal text-rose-600">{minPre?.error || (targetMinPct === "" ? "比率未入力" : (!protectHolder ? "株主未選択" : "算出不可"))}</span>}</dd></div>
          </dl>
          {!result?.valid ? (
            <p className="text-[11px] leading-5 text-rose-600">{result?.error || "入力を確認してね"}</p>
          ) : !protectHolder ? (
            <p className="text-[11px] leading-5 text-amber-700">守りたい株主を選ぶと比率の変化が出るよ。</p>
          ) : null}

          <div>
            <div className="mb-1.5 text-[10px] font-medium text-slate-500">pre-money感度（{protectHolder || "対象株主"}のラウンド後%）</div>
            <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-slate-400">参考</div>
            <dl className="divide-y divide-slate-200 rounded-sm border border-slate-200 bg-white text-[10px]">
              {sensitivity.map((point) => (
                <div key={point.multiplier} className="flex items-center justify-between gap-2 px-2 py-1">
                  <dt className="text-slate-500">{point.multiplier}x（pre-money {formatYen(point.preMoneyYen)}）</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{point.watchedPct != null ? `${point.watchedPct.toFixed(1)}%` : "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function CockpitCompanyOverview({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [data, setData] = useState<CompanyOverviewData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [equityDefaultType, setEquityDefaultType] = useState("new_issue");
  const exportRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/governance?projectId=${encodeURIComponent(projectId)}`);
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "会社概要を読み込めなかったよ");
      setData(json);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "会社概要を読み込めなかったよ");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const snapshots = useMemo(() => buildCapTableSnapshots(data), [data]);
  useEffect(() => {
    if (!snapshots.length) setSelectedSnapshotId("");
    else if (!snapshots.some((snapshot) => snapshot.id === selectedSnapshotId)) setSelectedSnapshotId(snapshots.at(-1)!.id);
  }, [selectedSnapshotId, snapshots]);
  const selectedSnapshot = snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || snapshots.at(-1) || null;
  const latestSnapshot = snapshots.at(-1) || null;
  const holderColorMap = useMemo(() => buildHolderColorMap(snapshots), [snapshots]);
  const originWarning = capTableOriginWarning(data, snapshots);
  const tieOut = capTableTieOut(data);
  const conversion = convertibleScenario(data);
  const latestRound = data.rounds.find((round) => round.price_per_share_yen != null || round.post_money_yen != null) || data.rounds[0];
  const selectedEquityValue = selectedSnapshot && latestRound?.price_per_share_yen
    ? selectedSnapshot.outstandingShares * Number(latestRound.price_per_share_yen)
    : latestRound?.post_money_yen || null;
  const profileCompleteness = [data.profile?.legal_name, data.profile?.head_office, data.profile?.business_purpose, data.profile?.capital_yen, data.profile?.board_structure, data.profile?.fiscal_year_end_month].filter((value) => value != null && value !== "").length;

  async function post(entity: string, row: Record<string, unknown>) {
    const response = await fetch("/api/governance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, row }) });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.error || "保存できなかったよ");
  }

  async function save(label: string, action: () => Promise<void>) {
    setSaving(true);
    setError("");
    try {
      await action();
      setDialog(null);
      await load();
      setNotice(`${label}を保存したよ`);
      window.setTimeout(() => setNotice(""), 3200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できなかったよ");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await save("会社基本情報", () => post("company_profile", {
      project_id: projectId,
      legal_status: form.get("legal_status"),
      legal_name: textOrNull(form.get("legal_name")), legal_name_en: textOrNull(form.get("legal_name_en")),
      corporate_number: textOrNull(form.get("corporate_number")), entity_type: textOrNull(form.get("entity_type")),
      incorporated_on: textOrNull(form.get("incorporated_on")), head_office: textOrNull(form.get("head_office")),
      business_purpose: textOrNull(form.get("business_purpose")), representative_name: textOrNull(form.get("representative_name")),
      capital_yen: numberOrNull(form.get("capital_yen")), authorized_shares: numberOrNull(form.get("authorized_shares")),
      registered_issued_shares: numberOrNull(form.get("registered_issued_shares")), board_structure: textOrNull(form.get("board_structure")),
      has_board: form.get("has_board") === "on", has_auditor: form.get("has_auditor") === "on",
      fiscal_year_end_month: numberOrNull(form.get("fiscal_year_end_month")), public_notice_method: textOrNull(form.get("public_notice_method")),
      invoice_registration_number: textOrNull(form.get("invoice_registration_number")), source_ref: textOrNull(form.get("source_ref")),
      source_verified_on: textOrNull(form.get("source_verified_on")), notes: textOrNull(form.get("notes")),
    }));
  }

  async function saveEquity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const transactionType = String(form.get("transaction_type"));
    const shares = Number(numberOrNull(form.get("shares")) || 0);
    const paidIn = Number(numberOrNull(form.get("paid_in_yen")) || 0);
    const holderType = String(form.get("holder_type") || "other");
    const toHolder = String(form.get("to_holder") || "").trim();
    const fromHolder = String(form.get("from_holder") || "").trim();
    const securityClass = String(form.get("security_class") || "普通株式").trim();
    if (!shares || shares < 0) { setError("株式数は0より大きい数で入力してね"); return; }
    if (transactionType === "transfer" && (!fromHolder || !toHolder)) { setError("譲渡元と譲渡先を入力してね"); return; }
    if (transactionType !== "transfer" && !toHolder) { setError("株主・付与先を入力してね"); return; }

    const entry = (holderName: string, outstanding: number, diluted: number, paidInYen = 0, klass = securityClass) => ({ holder_type: holderType, holder_name: holderName, security_class: klass, outstanding_delta: outstanding, diluted_delta: diluted, paid_in_yen_delta: paidInYen });
    let entries;
    if (transactionType === "transfer") entries = [entry(fromHolder, -shares, -shares), entry(toHolder, shares, shares)];
    else if (transactionType === "stock_option_grant") entries = [entry(toHolder, 0, shares, 0, securityClass || "新株予約権")];
    else if (transactionType === "stock_option_exercise") entries = [entry(toHolder, 0, -shares, 0, securityClass || "新株予約権"), entry(toHolder, shares, shares, paidIn, "普通株式")];
    else if (transactionType === "cancellation") entries = [entry(toHolder, -shares, -shares)];
    else entries = [entry(toHolder, shares, shares, paidIn)];

    const roundId = String(form.get("round_id") || "none");

    await save("株式イベント", () => post("equity_transaction", {
      project_id: projectId, round_id: roundId === "none" ? null : roundId, effective_on: form.get("effective_on"), transaction_type: transactionType,
      description: textOrNull(form.get("description")), status: form.get("status"), source_ref: textOrNull(form.get("source_ref")),
      notes: textOrNull(form.get("notes")), entries,
    }));
  }

  async function saveRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await save("調達ラウンド", () => post("round", {
      project_id: projectId, round_name: textOrNull(form.get("round_name")), round_date: textOrNull(form.get("round_date")),
      pre_money_yen: numberOrNull(form.get("pre_money_yen")), post_money_yen: numberOrNull(form.get("post_money_yen")),
      raised_yen: numberOrNull(form.get("raised_yen")), price_per_share_yen: numberOrNull(form.get("price_per_share_yen")),
      lead_investor: textOrNull(form.get("lead_investor")), source_ref: textOrNull(form.get("source_ref")), notes: textOrNull(form.get("notes")),
    }));
  }

  async function saveConvertible(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const discount = numberOrNull(form.get("discount_rate_pct"));
    await save("転換前証券", () => post("convertible", {
      project_id: projectId, holder_name: textOrNull(form.get("holder_name")), instrument_type: form.get("instrument_type"),
      issued_on: textOrNull(form.get("issued_on")), principal_yen: numberOrNull(form.get("principal_yen")),
      valuation_cap_yen: numberOrNull(form.get("valuation_cap_yen")), discount_rate: discount == null ? null : Number(discount) / 100,
      conversion_trigger: textOrNull(form.get("conversion_trigger")), maturity_on: textOrNull(form.get("maturity_on")),
      estimated_conversion_price: numberOrNull(form.get("estimated_conversion_price")), estimated_conversion_shares: numberOrNull(form.get("estimated_conversion_shares")),
      status: form.get("status"), source_ref: textOrNull(form.get("source_ref")), notes: textOrNull(form.get("notes")),
    }));
  }

  async function saveFinancial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await save("年度決算", () => post("financial_period", {
      project_id: projectId, fiscal_year: numberOrNull(form.get("fiscal_year")), period_start_on: textOrNull(form.get("period_start_on")),
      period_end_on: textOrNull(form.get("period_end_on")), statement_status: form.get("statement_status"),
      revenue_yen: numberOrNull(form.get("revenue_yen")), operating_income_yen: numberOrNull(form.get("operating_income_yen")),
      ordinary_income_yen: numberOrNull(form.get("ordinary_income_yen")), net_income_yen: numberOrNull(form.get("net_income_yen")),
      total_assets_yen: numberOrNull(form.get("total_assets_yen")), total_liabilities_yen: numberOrNull(form.get("total_liabilities_yen")),
      net_assets_yen: numberOrNull(form.get("net_assets_yen")), cash_yen: numberOrNull(form.get("cash_yen")), debt_yen: numberOrNull(form.get("debt_yen")),
      filed_on: textOrNull(form.get("filed_on")), source_ref: textOrNull(form.get("source_ref")), notes: textOrNull(form.get("notes")),
    }));
  }

  async function saveMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const resolutions = String(form.get("resolutions") || "").split("\n").map((title) => title.trim()).filter(Boolean).map((title) => ({ title, result: "unknown" }));
    const attachmentName = textOrNull(form.get("attachment_name"));
    const attachmentUrl = textOrNull(form.get("attachment_url"));
    await save("総会・役会情報", () => post("meeting", {
      project_id: projectId, meeting_type: form.get("meeting_type"), meeting_date: textOrNull(form.get("meeting_date")),
      location: textOrNull(form.get("location")), agenda_summary: textOrNull(form.get("agenda_summary")), resolutions_json: resolutions,
      amd_response: form.get("amd_response"), attachments_json: attachmentUrl ? [{ name: attachmentName || "関連資料", url: attachmentUrl }] : [],
      source_ref: textOrNull(form.get("source_ref")), notes: textOrNull(form.get("notes")),
    }));
  }

  async function exportPdf() {
    if (!exportRef.current) return;
    setExportingPdf(true);
    setError("");
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(exportRef.current, { scale: 1.7, backgroundColor: "#f8fafc", useCORS: true, logging: false });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const imageWidth = pageWidth - margin * 2;
      const imageHeight = canvas.height * imageWidth / canvas.width;
      const image = canvas.toDataURL("image/jpeg", 0.9);
      let offset = 0;
      while (offset < imageHeight) {
        if (offset > 0) pdf.addPage();
        pdf.addImage(image, "JPEG", margin, margin - offset, imageWidth, imageHeight, undefined, "FAST");
        offset += pageHeight - margin * 2;
      }
      pdf.save(`${projectName.replace(/[\\/:*?"<>|]/g, "_")}_会社概要_cap-table.pdf`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDFを作れなかったよ");
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading && !data.profile && data.transactions.length === 0) {
    return <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500"><Loader2 className="mr-2 size-4 animate-spin" />会社概要を読み込み中…</div>;
  }

  return (
    <div className="space-y-4" data-testid="company-overview-tab">
      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-white sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><Building2 className="size-4 text-slate-300" /><h1 className="text-base font-semibold tracking-tight">{data.profile?.legal_name || projectName}</h1></div>
          <p className="mt-1 text-xs leading-5 text-slate-300">会社情報・資本政策・機関決定・決算を、全メンバーで更新するPJ正本</p>
        </div>
        <div className="flex flex-wrap gap-2" data-html2canvas-ignore="true">
          <Button variant="outline" className="h-11 border-slate-600 bg-slate-900 text-white hover:bg-slate-800 hover:text-white" onClick={() => downloadCompanyOverviewXlsx(projectName, data)}><FileSpreadsheet />Excel</Button>
          <Button variant="outline" className="h-11 border-slate-600 bg-slate-900 text-white hover:bg-slate-800 hover:text-white" onClick={() => void exportPdf()} disabled={exportingPdf}>{exportingPdf ? <Loader2 className="animate-spin" /> : <Download />}PDF</Button>
          <Button variant="outline" className="h-11 border-slate-600 bg-slate-900 text-white hover:bg-slate-800 hover:text-white" onClick={() => void load()}><RefreshCw />更新</Button>
        </div>
      </div>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><Check className="size-4" />{notice}</div>}

      <div ref={exportRef} className="space-y-4 rounded-2xl bg-slate-50">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-[11px] text-slate-500"><span>基本情報</span><Building2 className="size-4" /></div><div className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{profileCompleteness}<span className="ml-1 text-xs font-normal text-slate-400">/ 6項目</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-slate-800" style={{ width: `${profileCompleteness / 6 * 100}%` }} /></div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-[11px] text-slate-500"><span>発行済株式</span><Users className="size-4" /></div><div className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{formatNumber(latestSnapshot?.outstandingShares, 2)}<span className="ml-1 text-xs font-normal text-slate-400">株</span></div><p className={`mt-2 text-[11px] ${tieOut.state === "mismatch" ? "text-rose-600" : tieOut.state === "matched" ? "text-emerald-700" : "text-slate-500"}`}>{tieOut.state === "matched" ? "登記株式数と一致" : tieOut.state === "mismatch" ? `登記との差 ${formatNumber(tieOut.difference, 2)}株` : "登記株式数は未入力"}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-[11px] text-slate-500"><span>完全希薄化後</span><WalletCards className="size-4" /></div><div className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{formatNumber(latestSnapshot?.dilutedShares, 2)}<span className="ml-1 text-xs font-normal text-slate-400">株</span></div><p className="mt-2 text-[11px] text-slate-500">転換見込を含む参考値 {formatNumber(conversion.proFormaDilutedShares, 2)}株</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-[11px] text-slate-500"><span>直近企業価値</span><Landmark className="size-4" /></div><div className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{formatYen(selectedEquityValue)}</div><p className="mt-2 truncate text-[11px] text-slate-500">{latestRound?.round_name || "ラウンド未入力"}</p></div>
        </div>

        <Section title="基本情報" description="登記・定款・最新の確認資料に基づく会社の現在値" action={<Button variant="outline" className="h-11" onClick={() => setDialog("profile")}><Pencil />編集</Button>}>
          <div className="grid sm:grid-cols-2">
            <InfoCell label="法人状態 / 法人形態" value={`${LEGAL_STATUS.find((option) => option.value === data.profile?.legal_status)?.label || "設立前"} / ${data.profile?.entity_type || "未入力"}`} />
            <InfoCell label="法人番号" value={compactCorporateNumber(data.profile?.corporate_number)} />
            <InfoCell label="商号" value={data.profile?.legal_name} />
            <InfoCell label="英文商号" value={data.profile?.legal_name_en} />
            <InfoCell label="設立日 / 代表者" value={[data.profile?.incorporated_on && formatDate(data.profile.incorporated_on), data.profile?.representative_name].filter(Boolean).join(" / ")} />
            <InfoCell label="資本金 / 決算月" value={`${formatYen(data.profile?.capital_yen)} / ${data.profile?.fiscal_year_end_month ? `${data.profile.fiscal_year_end_month}月` : "未入力"}`} />
            <InfoCell label="本店所在地" value={data.profile?.head_office} wide />
            <InfoCell label="事業内容・定款目的" value={data.profile?.business_purpose} wide />
            <InfoCell label="機関設計" value={[data.profile?.board_structure, data.profile?.has_board == null ? null : data.profile.has_board ? "取締役会設置" : "取締役会非設置", data.profile?.has_auditor == null ? null : data.profile.has_auditor ? "監査役設置" : "監査役非設置"].filter(Boolean).join(" / ")} wide />
            <InfoCell label="公告方法" value={data.profile?.public_notice_method} />
            <InfoCell label="適格請求書発行事業者番号" value={data.profile?.invoice_registration_number} />
            <InfoCell label="確認元 / 確認日" value={[data.profile?.source_ref, data.profile?.source_verified_on && formatDate(data.profile.source_verified_on)].filter(Boolean).join(" / ")} wide />
          </div>
        </Section>

        <CapitalPolicyWorkspace
          data={data}
          snapshots={snapshots}
          rounds={data.rounds}
          colorMap={holderColorMap}
          baseId={selectedSnapshot?.id || ""}
          onSelectBase={setSelectedSnapshotId}
          originWarning={originWarning}
          onAddFoundingEvent={() => { setEquityDefaultType("incorporation"); setDialog("equity"); }}
        />

        <Section title="資金調達・潜在株式" description="株式ラウンドとJ-KISS・SAFE等は分けて管理。転換前証券は現在持株比率へ混ぜない" action={<div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11" onClick={() => setDialog("round")}><Plus />ラウンド</Button><Button variant="outline" className="h-11" onClick={() => setDialog("convertible")}><Plus />転換前証券</Button></div>}>
          {data.rounds.length === 0 && data.convertibles.length === 0 ? <EmptyState>調達ラウンドや転換前証券を追加すると、企業価値と希薄化の検討材料をまとめられるよ。</EmptyState> : <div className="grid divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="p-4 sm:p-5"><div className="mb-3 text-[11px] font-semibold text-slate-500">株式ラウンド</div><div className="space-y-3">{data.rounds.map((round) => <div key={round.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><div><div className="text-sm font-semibold text-slate-900">{round.round_name || "名称未入力"}</div><div className="mt-1 text-[11px] text-slate-500">{formatDate(round.round_date || round.round_ym)}</div></div><div className="text-right"><div className="text-xs font-semibold text-slate-900">{formatYen(round.raised_yen)}</div><div className="mt-1 text-[10px] text-slate-500">調達額</div></div></div><div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-slate-500"><div>pre<br/><span className="text-xs font-medium text-slate-800">{formatYen(round.pre_money_yen)}</span></div><div>post<br/><span className="text-xs font-medium text-slate-800">{formatYen(round.post_money_yen)}</span></div><div>1株<br/><span className="text-xs font-medium text-slate-800">{formatYen(round.price_per_share_yen)}</span></div></div></div>)}</div></div>
            <div className="p-4 sm:p-5"><div className="mb-3 flex items-center justify-between text-[11px] font-semibold text-slate-500"><span>転換前証券</span><span>転換見込 {formatNumber(conversion.estimatedShares, 2)}株</span></div><div className="space-y-3">{data.convertibles.map((instrument) => <div key={instrument.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3"><div className="flex items-start justify-between gap-2"><div><div className="text-sm font-semibold text-slate-900">{instrument.holder_name}</div><div className="mt-1 text-[11px] text-slate-500">{instrument.instrument_type} / {statusLabel(instrument.status)}</div></div><div className="text-right text-xs font-semibold text-slate-900">{formatYen(instrument.principal_yen)}</div></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-500"><div>評価上限<br/><span className="text-xs font-medium text-slate-800">{formatYen(instrument.valuation_cap_yen)}</span></div><div>転換見込<br/><span className="text-xs font-medium text-slate-800">{formatNumber(instrument.estimated_conversion_shares, 2)}株</span></div></div></div>)}</div></div>
          </div>}
        </Section>

        <div className="grid gap-4 xl:grid-cols-2">
          <Section title="総会・取締役会" description="決議、AMD対応、関連資料を開催履歴と一緒に保存" action={<Button variant="outline" className="h-11" onClick={() => setDialog("meeting")}><Plus />開催情報</Button>}>
            {data.meetings.length === 0 ? <EmptyState>総会・取締役会の開催情報はまだないよ。</EmptyState> : <div className="divide-y divide-slate-100">{data.meetings.map((meeting) => <div key={meeting.id} className="px-4 py-4 sm:px-5"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold tabular-nums text-slate-900">{formatDate(meeting.meeting_date)}</span><span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-600">{meetingLabel(meeting.meeting_type)}</span>{meeting.amd_response && <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">AMD: {meeting.amd_response}</span>}</div>{meeting.agenda_summary && <p className="mt-2 text-xs leading-5 text-slate-600">{meeting.agenda_summary}</p>}{meeting.resolutions_json?.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-slate-500">{meeting.resolutions_json.map((resolution, index) => <li key={index}>{resolution.title}</li>)}</ul> : null}{meeting.attachments_json?.length ? <div className="mt-3 flex flex-wrap gap-2">{meeting.attachments_json.map((attachment, index) => sourceHref(attachment) ? <a key={index} href={sourceHref(attachment)} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-50 hover:underline">資料: {attachment.name || index + 1}</a> : null)}</div> : null}</div>)}</div>}
          </Section>

          <Section title="年度決算" description="月次の経営PLとは分け、確定・申告した年度数値を保存" action={<Button variant="outline" className="h-11" onClick={() => setDialog("financial")}><Plus />決算</Button>}>
            {data.financialPeriods.length === 0 ? <EmptyState>年度決算はまだ入力されていないよ。</EmptyState> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-4 py-3 text-left font-medium">年度</th><th className="px-3 py-3 text-left font-medium">状態</th><th className="px-3 py-3 text-right font-medium">売上高</th><th className="px-3 py-3 text-right font-medium">営業利益</th><th className="px-3 py-3 text-right font-medium">純利益</th><th className="px-4 py-3 text-right font-medium">純資産</th></tr></thead><tbody className="divide-y divide-slate-100">{data.financialPeriods.map((period) => <tr key={period.id}><td className="px-4 py-3 font-semibold tabular-nums text-slate-900">{period.fiscal_year}</td><td className="px-3 py-3 text-slate-600">{statusLabel(period.statement_status)}</td><td className="px-3 py-3 text-right tabular-nums">{formatYen(period.revenue_yen)}</td><td className={`px-3 py-3 text-right tabular-nums ${Number(period.operating_income_yen) < 0 ? "text-rose-600" : ""}`}>{formatYen(period.operating_income_yen)}</td><td className={`px-3 py-3 text-right tabular-nums ${Number(period.net_income_yen) < 0 ? "text-rose-600" : ""}`}>{formatYen(period.net_income_yen)}</td><td className="px-4 py-3 text-right tabular-nums">{formatYen(period.net_assets_yen)}</td></tr>)}</tbody></table></div>}
          </Section>
        </div>

        {data.actionItems.length > 0 && <Section title="会社運営の要対応" description="総会・登記・株主対応など、期限が残っているもの"><div className="divide-y divide-slate-100">{data.actionItems.map((item) => <div key={item.action_id} className="flex items-start gap-3 px-4 py-3 sm:px-5"><Scale className="mt-0.5 size-4 shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><div className="text-xs font-medium text-slate-900">{item.title}</div>{item.summary && <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.summary}</p>}</div><span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] ${item.due_at && new Date(item.due_at).getTime() < Date.now() ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{item.due_at ? formatDate(item.due_at.slice(0, 10)) : "期日なし"}</span></div>)}</div></Section>}
      </div>

      <Dialog open={dialog === "profile"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-3xl"><form onSubmit={(event) => void saveProfile(event)}><DialogHeader><DialogTitle>会社基本情報を編集</DialogTitle><DialogDescription>登記・定款など、確認した資料を確認元に残してね。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2">
        <Field label="法人状態"><NativeSelect name="legal_status" defaultValue={data.profile?.legal_status || "pre_incorporation"} options={LEGAL_STATUS} /></Field>
        <Field label="法人形態" name="entity_type"><Input id="entity_type" name="entity_type" defaultValue={data.profile?.entity_type || "株式会社"} className="h-11" /></Field>
        <Field label="商号" name="legal_name"><Input id="legal_name" name="legal_name" defaultValue={data.profile?.legal_name || ""} className="h-11" /></Field>
        <Field label="英文商号" name="legal_name_en"><Input id="legal_name_en" name="legal_name_en" defaultValue={data.profile?.legal_name_en || ""} className="h-11" /></Field>
        <Field label="法人番号" name="corporate_number"><Input id="corporate_number" name="corporate_number" defaultValue={data.profile?.corporate_number || ""} inputMode="numeric" className="h-11" /></Field>
        <Field label="設立日" name="incorporated_on" hint="YYYY-MM-DD"><Input id="incorporated_on" name="incorporated_on" defaultValue={data.profile?.incorporated_on || ""} placeholder="2026-07-16" className="h-11" /></Field>
        <Field label="代表者" name="representative_name"><Input id="representative_name" name="representative_name" defaultValue={data.profile?.representative_name || ""} className="h-11" /></Field>
        <Field label="決算月" name="fiscal_year_end_month"><Input id="fiscal_year_end_month" name="fiscal_year_end_month" defaultValue={data.profile?.fiscal_year_end_month || ""} inputMode="numeric" placeholder="12" className="h-11" /></Field>
        <div className="sm:col-span-2"><Field label="本店所在地" name="head_office"><Input id="head_office" name="head_office" defaultValue={data.profile?.head_office || ""} className="h-11" /></Field></div>
        <div className="sm:col-span-2"><Field label="事業内容・定款目的" name="business_purpose"><Textarea id="business_purpose" name="business_purpose" defaultValue={data.profile?.business_purpose || ""} rows={4} /></Field></div>
        <Field label="資本金（円）" name="capital_yen"><Input id="capital_yen" name="capital_yen" defaultValue={data.profile?.capital_yen || ""} inputMode="numeric" className="h-11" /></Field>
        <Field label="発行可能株式総数" name="authorized_shares"><Input id="authorized_shares" name="authorized_shares" defaultValue={data.profile?.authorized_shares || ""} inputMode="decimal" className="h-11" /></Field>
        <Field label="登記上の発行済株式数" name="registered_issued_shares"><Input id="registered_issued_shares" name="registered_issued_shares" defaultValue={data.profile?.registered_issued_shares || ""} inputMode="decimal" className="h-11" /></Field>
        <Field label="機関設計" name="board_structure"><Input id="board_structure" name="board_structure" defaultValue={data.profile?.board_structure || ""} placeholder="取締役1名・監査役非設置" className="h-11" /></Field>
        <div className="flex items-center gap-6 rounded-xl border border-slate-200 px-4 py-3 sm:col-span-2"><label className="flex min-h-8 items-center gap-2 text-xs"><input type="checkbox" name="has_board" defaultChecked={data.profile?.has_board || false} className="size-4 accent-slate-900" />取締役会設置</label><label className="flex min-h-8 items-center gap-2 text-xs"><input type="checkbox" name="has_auditor" defaultChecked={data.profile?.has_auditor || false} className="size-4 accent-slate-900" />監査役設置</label></div>
        <Field label="公告方法" name="public_notice_method"><Input id="public_notice_method" name="public_notice_method" defaultValue={data.profile?.public_notice_method || ""} className="h-11" /></Field>
        <Field label="適格請求書発行事業者番号" name="invoice_registration_number"><Input id="invoice_registration_number" name="invoice_registration_number" defaultValue={data.profile?.invoice_registration_number || ""} className="h-11" /></Field>
        <Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" defaultValue={data.profile?.source_ref || ""} placeholder="登記簿 / 定款 / Drive資料名" className="h-11" /></Field>
        <Field label="確認日" name="source_verified_on"><Input id="source_verified_on" name="source_verified_on" defaultValue={data.profile?.source_verified_on || ""} placeholder="2026-07-16" className="h-11" /></Field>
        <div className="sm:col-span-2"><Field label="メモ" name="notes"><Textarea id="notes" name="notes" defaultValue={data.profile?.notes || ""} /></Field></div>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="animate-spin" />}保存</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={dialog === "equity"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl"><form onSubmit={(event) => void saveEquity(event)}><DialogHeader><DialogTitle>株式イベントを追加</DialogTitle><DialogDescription>確定イベントだけが現在のcap tableに反映されるよ。譲渡は譲渡元と譲渡先を同時に記録する。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2">
        <Field label="イベント"><NativeSelect key={equityDefaultType} name="transaction_type" defaultValue={equityDefaultType} options={TRANSACTION_TYPES} /></Field>
        <Field label="状態"><NativeSelect name="status" defaultValue="confirmed" options={[{ value: "planned", label: "計画" }, { value: "confirmed", label: "確定" }]} /></Field>
        <Field label="効力日" name="effective_on" hint="YYYY-MM-DD"><Input id="effective_on" name="effective_on" required defaultValue={new Date().toISOString().slice(0, 10)} className="h-11" /></Field>
        <Field label="株主区分"><NativeSelect name="holder_type" defaultValue="founder" options={HOLDER_TYPES} /></Field>
        <Field label="関連ラウンド" hint="任意。ラウンドと株式イベントを紐付けたいときに選択"><NativeSelect name="round_id" defaultValue="none" options={[{ value: "none", label: "なし" }, ...data.rounds.map((round) => ({ value: round.id, label: round.round_name || formatDate(round.round_date || round.round_ym) }))]} /></Field>
        <Field label="譲渡元（譲渡のとき）" name="from_holder"><Input id="from_holder" name="from_holder" className="h-11" /></Field>
        <Field label="株主・譲渡先・付与先" name="to_holder"><Input id="to_holder" name="to_holder" className="h-11" /></Field>
        <Field label="証券種別" name="security_class"><Input id="security_class" name="security_class" defaultValue="普通株式" className="h-11" /></Field>
        <Field label="株式数 / 個数" name="shares"><Input id="shares" name="shares" inputMode="decimal" required className="h-11" /></Field>
        <Field label="払込総額（円）" name="paid_in_yen" hint="譲渡なら会社への払込ではないので0"><Input id="paid_in_yen" name="paid_in_yen" inputMode="numeric" className="h-11" /></Field>
        <Field label="説明" name="description"><Input id="description" name="description" placeholder="Seed増資、創業時発行など" className="h-11" /></Field>
        <Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" placeholder="株主名簿 / 払込証明 / 契約" className="h-11" /></Field>
        <div className="sm:col-span-2"><Field label="メモ" name="notes"><Textarea id="notes" name="notes" /></Field></div>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="animate-spin" />}追加</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={dialog === "round"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl"><form onSubmit={(event) => void saveRound(event)}><DialogHeader><DialogTitle>調達ラウンドを追加</DialogTitle><DialogDescription>株式イベントとラウンド情報を分けることで、持株計算とバリュエーションを混同しない。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2">
        <Field label="ラウンド名" name="round_name"><Input id="round_name" name="round_name" placeholder="Seed" required className="h-11" /></Field><Field label="実施日" name="round_date"><Input id="round_date" name="round_date" placeholder="2026-07-16" className="h-11" /></Field>
        <Field label="pre-money（円）" name="pre_money_yen"><Input id="pre_money_yen" name="pre_money_yen" inputMode="numeric" className="h-11" /></Field><Field label="post-money（円）" name="post_money_yen"><Input id="post_money_yen" name="post_money_yen" inputMode="numeric" className="h-11" /></Field>
        <Field label="調達額（円）" name="raised_yen"><Input id="raised_yen" name="raised_yen" inputMode="numeric" className="h-11" /></Field><Field label="1株単価（円）" name="price_per_share_yen"><Input id="price_per_share_yen" name="price_per_share_yen" inputMode="decimal" className="h-11" /></Field>
        <Field label="リード投資家" name="lead_investor"><Input id="lead_investor" name="lead_investor" className="h-11" /></Field><Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" className="h-11" /></Field>
        <div className="sm:col-span-2"><Field label="メモ" name="notes"><Textarea id="notes" name="notes" /></Field></div>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>追加</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={dialog === "convertible"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl"><form onSubmit={(event) => void saveConvertible(event)}><DialogHeader><DialogTitle>転換前証券を追加</DialogTitle><DialogDescription>現在の持株比率には入れず、転換見込シナリオとして別表示するよ。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2">
        <Field label="保有者" name="holder_name"><Input id="holder_name" name="holder_name" required className="h-11" /></Field><Field label="証券"><NativeSelect name="instrument_type" defaultValue="J-KISS" options={[{ value: "J-KISS", label: "J-KISS" }, { value: "SAFE", label: "SAFE" }, { value: "CB", label: "転換社債" }, { value: "other", label: "その他" }]} /></Field>
        <Field label="発行日" name="issued_on"><Input id="issued_on" name="issued_on" placeholder="2026-07-16" className="h-11" /></Field><Field label="状態"><NativeSelect name="status" defaultValue="outstanding" options={[{ value: "outstanding", label: "転換前" }, { value: "converted", label: "転換済み" }, { value: "repaid", label: "償還済み" }, { value: "cancelled", label: "取消" }]} /></Field>
        <Field label="元本（円）" name="principal_yen"><Input id="principal_yen" name="principal_yen" inputMode="numeric" className="h-11" /></Field><Field label="評価上限（円）" name="valuation_cap_yen"><Input id="valuation_cap_yen" name="valuation_cap_yen" inputMode="numeric" className="h-11" /></Field>
        <Field label="割引率（%）" name="discount_rate_pct"><Input id="discount_rate_pct" name="discount_rate_pct" inputMode="decimal" placeholder="20" className="h-11" /></Field><Field label="満期日" name="maturity_on"><Input id="maturity_on" name="maturity_on" className="h-11" /></Field>
        <Field label="転換見込単価（円）" name="estimated_conversion_price"><Input id="estimated_conversion_price" name="estimated_conversion_price" inputMode="decimal" className="h-11" /></Field><Field label="転換見込株式数" name="estimated_conversion_shares"><Input id="estimated_conversion_shares" name="estimated_conversion_shares" inputMode="decimal" className="h-11" /></Field>
        <div className="sm:col-span-2"><Field label="転換条件" name="conversion_trigger"><Textarea id="conversion_trigger" name="conversion_trigger" /></Field></div><Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" className="h-11" /></Field><Field label="メモ" name="notes"><Input id="notes" name="notes" className="h-11" /></Field>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>追加</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={dialog === "financial"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-3xl"><form onSubmit={(event) => void saveFinancial(event)}><DialogHeader><DialogTitle>年度決算を追加・更新</DialogTitle><DialogDescription>同じ年度を保存すると、その年度の数値を更新するよ。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-3">
        <Field label="年度" name="fiscal_year"><Input id="fiscal_year" name="fiscal_year" required inputMode="numeric" defaultValue={new Date().getFullYear()} className="h-11" /></Field><Field label="状態"><NativeSelect name="statement_status" defaultValue="draft" options={[{ value: "draft", label: "下書き" }, { value: "final", label: "確定" }, { value: "filed", label: "申告済み" }]} /></Field><Field label="申告日" name="filed_on"><Input id="filed_on" name="filed_on" className="h-11" /></Field>
        <Field label="期間開始" name="period_start_on"><Input id="period_start_on" name="period_start_on" className="h-11" /></Field><Field label="期間終了" name="period_end_on"><Input id="period_end_on" name="period_end_on" className="h-11" /></Field><Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" className="h-11" /></Field>
        {["revenue_yen:売上高", "operating_income_yen:営業利益", "ordinary_income_yen:経常利益", "net_income_yen:当期純利益", "total_assets_yen:総資産", "total_liabilities_yen:負債", "net_assets_yen:純資産", "cash_yen:現預金", "debt_yen:有利子負債"].map((entry) => { const [name, label] = entry.split(":"); return <Field key={name} label={`${label}（円）`} name={name}><Input id={name} name={name} inputMode="numeric" className="h-11" /></Field>; })}
        <div className="sm:col-span-3"><Field label="メモ" name="notes"><Textarea id="notes" name="notes" /></Field></div>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>保存</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={dialog === "meeting"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl"><form onSubmit={(event) => void saveMeeting(event)}><DialogHeader><DialogTitle>総会・取締役会を追加</DialogTitle><DialogDescription>招集・決議・AMDの対応・資料を、同じ開催記録へまとめるよ。</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2">
        <Field label="種別"><NativeSelect name="meeting_type" defaultValue="board" options={MEETING_TYPES} /></Field><Field label="開催日" name="meeting_date"><Input id="meeting_date" name="meeting_date" required className="h-11" /></Field>
        <Field label="場所・方法" name="location"><Input id="location" name="location" placeholder="オンライン / 本店 / 書面" className="h-11" /></Field><Field label="AMD対応"><NativeSelect name="amd_response" defaultValue="none" options={[{ value: "none", label: "未対応" }, { value: "attended", label: "出席" }, { value: "proxy", label: "委任状提出" }, { value: "consented", label: "事前承諾" }, { value: "abstained", label: "棄権" }]} /></Field>
        <div className="sm:col-span-2"><Field label="議題概要" name="agenda_summary"><Textarea id="agenda_summary" name="agenda_summary" /></Field></div><div className="sm:col-span-2"><Field label="決議（1行1件）" name="resolutions"><Textarea id="resolutions" name="resolutions" /></Field></div>
        <Field label="資料名" name="attachment_name"><Input id="attachment_name" name="attachment_name" className="h-11" /></Field><Field label="資料URL" name="attachment_url"><Input id="attachment_url" name="attachment_url" inputMode="url" className="h-11" /></Field>
        <Field label="確認元" name="source_ref"><Input id="source_ref" name="source_ref" className="h-11" /></Field><Field label="メモ" name="notes"><Input id="notes" name="notes" className="h-11" /></Field>
      </div><DialogFooter><Button type="button" variant="outline" className="h-11" onClick={() => setDialog(null)}>閉じる</Button><Button type="submit" className="h-11" disabled={saving}>追加</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}
