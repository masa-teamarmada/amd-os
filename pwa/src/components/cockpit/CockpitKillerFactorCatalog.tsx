"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  CircleAlert,
  CircleCheckBig,
  CircleDashed,
  Clock3,
  Eye,
  FileCheck2,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PREVENTION_STATUSES,
  MONITORING_STATUSES,
  summarizeKillerFactorRisk,
  type KillerFactorOperatingMode,
  type KillerFactorOverallLevel,
  type KillerFactorStatus,
} from "@/lib/killer-factor-risk";

type KillerFactorItem = {
  killerFactorId: string;
  operatingMode: KillerFactorOperatingMode;
  factorType: string;
  eventDescription: string;
  observationClues: string;
  preventiveAction: string | null;
  timingGuidance: string | null;
  status: KillerFactorStatus;
  statusOn: string | null;
  targetOn: string | null;
  evidenceNote: string | null;
  recordedByMemberId: string | null;
  recordedByLabel: string | null;
  recordedAt: string | null;
};

type RiskFilter = "all" | KillerFactorOperatingMode;

type StatusPresentation = {
  label: string;
  icon: LucideIcon;
  className: string;
};

const STATUS_PRESENTATION: Record<KillerFactorStatus, StatusPresentation> = {
  unchecked: {
    label: "未確認",
    icon: CircleDashed,
    className: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
  },
  clear: {
    label: "異常なし",
    icon: CircleCheckBig,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  },
  warning: {
    label: "兆候あり",
    icon: TriangleAlert,
    className: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
  },
  occurred: {
    label: "発生",
    icon: CircleAlert,
    className: "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100",
  },
  not_started: {
    label: "未着手",
    icon: CircleAlert,
    className: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
  },
  in_progress: {
    label: "対応中",
    icon: Clock3,
    className: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
  },
  controlled: {
    label: "統制済",
    icon: ShieldCheck,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  },
  breached: {
    label: "逸脱",
    icon: ShieldAlert,
    className: "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100",
  },
};

const OVERALL_PRESENTATION: Record<KillerFactorOverallLevel, { label: string; className: string }> = {
  critical: { label: "危険", className: "border-rose-300 bg-rose-50 text-rose-800" },
  attention: { label: "要対応", className: "border-amber-300 bg-amber-50 text-amber-900" },
  unknown: { label: "要確認", className: "border-slate-300 bg-slate-100 text-slate-800" },
  stable: { label: "安定", className: "border-emerald-300 bg-emerald-50 text-emerald-800" },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("-", "/");
}

function todayInJapan() {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function Field({ label, name, children, hint }: { label: string; name: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs text-slate-700">{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

function modeLabel(mode: KillerFactorOperatingMode) {
  return mode === "prevention" ? "予防統制" : "常時監視";
}

function defaultStatusFor(mode: KillerFactorOperatingMode): KillerFactorStatus {
  return mode === "prevention" ? "not_started" : "clear";
}

export function CockpitKillerFactorCatalog({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<KillerFactorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<RiskFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<KillerFactorOperatingMode>("monitoring");
  const [editFactor, setEditFactor] = useState<KillerFactorItem | null>(null);
  const [editingStatus, setEditingStatus] = useState<KillerFactorStatus>("clear");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/governance/killer-factors?projectId=${encodeURIComponent(projectId)}`);
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "キラー要素カタログを読み込めなかったよ");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "キラー要素カタログを読み込めなかったよ");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => summarizeKillerFactorRisk(items), [items]);
  const filteredItems = useMemo(
    () => filter === "all" ? items : items.filter((item) => item.operatingMode === filter),
    [filter, items],
  );
  const preventionCount = useMemo(() => items.filter((item) => item.operatingMode === "prevention").length, [items]);
  const monitoringCount = items.length - preventionCount;
  const overall = OVERALL_PRESENTATION[summary.level];

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/governance/killer-factors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.error || "保存できなかったよ");
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  }

  function openStateEditor(item: KillerFactorItem) {
    setEditingStatus(item.status === "unchecked" ? defaultStatusFor(item.operatingMode) : item.status);
    setEditFactor(item);
  }

  async function saveFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await post({
        action: "create_factor",
        operatingMode: addMode,
        factorType: String(form.get("factor_type") || ""),
        eventDescription: String(form.get("event_description") || ""),
        observationClues: String(form.get("observation_clues") || ""),
        preventiveAction: String(form.get("preventive_action") || ""),
        timingGuidance: String(form.get("timing_guidance") || ""),
      });
      setAddOpen(false);
      setAddMode("monitoring");
      await load();
      showNotice("共通カタログへ追加したよ。全PJに未確認で反映されてる");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "要素を追加できなかったよ");
    } finally {
      setSaving(false);
    }
  }

  async function saveState(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editFactor) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await post({
        action: "update_state",
        projectId,
        killerFactorId: editFactor.killerFactorId,
        status: editingStatus,
        statusOn: String(form.get("status_on") || ""),
        targetOn: editFactor.operatingMode === "prevention" ? String(form.get("target_on") || "") : "",
        evidenceNote: String(form.get("evidence_note") || ""),
      });
      setEditFactor(null);
      await load();
      showNotice("このPJの状態を更新したよ");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "状態を保存できなかったよ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      data-testid="killer-factor-catalog"
    >
      <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldAlert className="size-4 text-slate-500" />
            <h2 className="text-sm font-semibold tracking-tight text-slate-950">キラー要素カタログ</h2>
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-600">
              {items.length}件
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
            AMDが先に塞ぐ予防統制と、継続して兆候を見る常時監視。未確認は安全扱いしない。
          </p>
        </div>
        <Button
          variant="outline"
          className="h-10 w-full shrink-0 sm:h-9 sm:w-auto"
          onClick={() => setAddOpen(true)}
          data-html2canvas-ignore="true"
        >
          <Plus />要素を追加
        </Button>
      </div>

      <div
        className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/70 sm:grid-cols-[minmax(12rem,1.4fr)_repeat(4,minmax(5rem,0.65fr))]"
        data-testid="killer-factor-risk-overview"
      >
        <div className="col-span-2 flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 sm:col-span-1 sm:border-b-0 sm:border-r sm:px-4">
          <div>
            <div className="text-[10px] font-medium text-slate-500">このPJの全体判定</div>
            <div className="mt-0.5 text-[11px] text-slate-600">
              {summary.level === "critical" && `${summary.criticalCount}件の重大事象`}
              {summary.level === "attention" && `${summary.actionCount}件が対応途上`}
              {summary.level === "unknown" && `${summary.unknownCount}件をまだ確認できていない`}
              {summary.level === "stable" && "全項目が異常なし・統制済"}
            </div>
          </div>
          <span className={`rounded-md border px-2.5 py-1 text-sm font-semibold ${overall.className}`}>{overall.label}</span>
        </div>
        {[
          { label: "重大", value: summary.criticalCount, className: "text-rose-700" },
          { label: "要対応", value: summary.actionCount, className: "text-amber-800" },
          { label: "未確認", value: summary.unknownCount, className: "text-slate-700" },
          { label: "安全", value: summary.safeCount, className: "text-emerald-700" },
        ].map((metric, index) => (
          <div key={metric.label} className={`flex min-h-12 items-center justify-between px-3 py-2 sm:min-h-14 sm:flex-col sm:justify-center sm:border-r sm:last:border-r-0 ${index % 2 === 0 ? "border-r border-slate-200" : ""}`}>
            <span className="text-[10px] font-medium text-slate-500">{metric.label}</span>
            <span className={`text-base font-semibold tabular-nums ${metric.className}`}>{metric.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 sm:px-4">
        <div role="tablist" aria-label="キラー要素の方式" className="flex items-center gap-1">
          {([
            ["all", "すべて", items.length],
            ["prevention", "予防統制", preventionCount],
            ["monitoring", "常時監視", monitoringCount],
          ] as const).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-8 rounded-md px-2.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${filter === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {label} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
        <div className="text-[10px] text-slate-500">状態を押して更新</div>
      </div>

      {error && (
        <div role="alert" className="m-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 sm:m-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}
        </div>
      )}
      {notice && (
        <div role="status" className="m-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 sm:m-4">
          <Check className="size-4 shrink-0" />{notice}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex min-h-28 items-center justify-center text-xs text-slate-500">
          <Loader2 className="mr-2 size-4 animate-spin" />カタログを読み込み中…
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs leading-5 text-slate-500">
          共通要素はまだないよ。「要素を追加」から最初の型を登録できる。
        </div>
      ) : (
        <div role="table" aria-label="キラー要素カタログ" data-testid="killer-factor-density-table">
          <div role="row" className="hidden grid-cols-[7rem_7.5rem_minmax(12rem,0.9fr)_minmax(16rem,1.25fr)_11.5rem] items-center gap-3 bg-slate-50 px-4 py-2 text-[10px] font-medium text-slate-500 lg:grid">
            <div role="columnheader">方式</div>
            <div role="columnheader">型</div>
            <div role="columnheader">リスク</div>
            <div role="columnheader">AMDの打ち手 / 見るもの</div>
            <div role="columnheader">このPJの状態</div>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const statusMeta = STATUS_PRESENTATION[item.status];
              const StatusIcon = statusMeta.icon;
              const critical = item.status === "occurred" || item.status === "breached";
              const guidance = item.operatingMode === "prevention"
                ? item.preventiveAction || "予防策未登録"
                : item.observationClues;
              return (
                <div
                  key={item.killerFactorId}
                  role="row"
                  data-testid="killer-factor-density-row"
                  className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2 gap-y-1.5 px-3 py-2.5 lg:min-h-14 lg:grid-cols-[7rem_7.5rem_minmax(12rem,0.9fr)_minmax(16rem,1.25fr)_11.5rem] lg:items-center lg:gap-3 lg:px-4 lg:py-2 ${critical ? "bg-rose-50/40" : "bg-white"}`}
                >
                  <div role="cell" className="col-start-1 row-start-1 min-w-0 lg:col-start-1 lg:row-start-1">
                    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${item.operatingMode === "prevention" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                      {item.operatingMode === "prevention" ? <ShieldCheck className="size-3" /> : <Eye className="size-3" />}
                      {modeLabel(item.operatingMode)}
                    </span>
                  </div>
                  <div role="cell" className="col-start-2 row-start-1 min-w-0 lg:col-start-2 lg:row-start-1">
                    <span className="text-xs font-semibold text-slate-800">{item.factorType}</span>
                  </div>
                  <div role="cell" className="col-span-3 row-start-2 min-w-0 lg:col-span-1 lg:col-start-3 lg:row-start-1">
                    <p className="line-clamp-1 text-xs font-medium leading-4 text-slate-900 lg:line-clamp-2" title={item.eventDescription}>{item.eventDescription}</p>
                  </div>
                  <div role="cell" className="col-span-3 row-start-3 min-w-0 lg:col-span-1 lg:col-start-4 lg:row-start-1">
                    <div className="flex min-w-0 items-start gap-1.5">
                      {item.operatingMode === "prevention" ? <FileCheck2 className="mt-0.5 size-3.5 shrink-0 text-blue-600" /> : <Eye className="mt-0.5 size-3.5 shrink-0 text-slate-400" />}
                      <p className="line-clamp-1 min-w-0 text-[11px] leading-4 text-slate-600 lg:line-clamp-2" title={guidance}>{guidance}</p>
                    </div>
                    {item.operatingMode === "prevention" && item.timingGuidance && (
                      <div className="mt-0.5 truncate pl-5 text-[10px] text-blue-700" title={item.timingGuidance}>期限目安: {item.timingGuidance}</div>
                    )}
                  </div>
                  <div role="cell" className="col-start-3 row-start-1 min-w-0 lg:col-start-5 lg:row-start-1">
                    <Button
                      type="button"
                      variant="outline"
                      className={`h-9 w-full min-w-0 justify-between gap-1.5 px-2.5 text-[11px] ${statusMeta.className}`}
                      onClick={() => openStateEditor(item)}
                      title={item.statusOn ? `${statusMeta.label} · ${formatDate(item.statusOn)} · ${item.recordedByLabel || "記録者未確認"}` : `${statusMeta.label} · 状態を更新`}
                      data-html2canvas-ignore="true"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <StatusIcon className="size-3.5 shrink-0" />
                        <span className="truncate">{statusMeta.label}</span>
                      </span>
                      {item.statusOn ? <span className="hidden shrink-0 tabular-nums opacity-70 xl:inline">{formatDate(item.statusOn).slice(5)}</span> : <Pencil className="size-3.5 shrink-0 opacity-70" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl">
          <form onSubmit={(event) => void saveFactor(event)}>
            <DialogHeader>
              <DialogTitle>共通カタログへ要素を追加</DialogTitle>
              <DialogDescription>全PJへ同じ雛形を追加する。まず「先に塞ぐ」か「継続して見る」かを決める。</DialogDescription>
            </DialogHeader>
            <div className="my-5 grid gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700">方式</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["prevention", "予防統制", "AMDが発生前に塞ぐ"],
                    ["monitoring", "常時監視", "兆候を継続確認する"],
                  ] as const).map(([value, label, description]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={addMode === value}
                      onClick={() => setAddMode(value)}
                      className={`min-h-14 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${addMode === value ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                    >
                      <span className="block text-xs font-semibold text-slate-900">{label}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">{description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Field label="型" name="factor_type" hint="既存の型に収まらないときは、新しい型名で追加する">
                <Input id="factor_type" name="factor_type" required maxLength={80} className="h-10" placeholder="例: 規制適合" />
              </Field>
              <Field label="避ける事象" name="event_description">
                <Input id="event_description" name="event_description" required maxLength={300} className="h-10" placeholder="事業化見込みを大きく削る事象" />
              </Field>
              {addMode === "prevention" && (
                <>
                  <Field label="AMDの打ち手" name="preventive_action" hint="発生前にAMDが完了させる具体的な統制を書く">
                    <Textarea id="preventive_action" name="preventive_action" required maxLength={1200} rows={3} placeholder="契約・権限・運用をどう先に整えるか" />
                  </Field>
                  <Field label="完了時機" name="timing_guidance">
                    <Input id="timing_guidance" name="timing_guidance" required maxLength={300} className="h-10" placeholder="例: 会社設立・外部資金受入の前" />
                  </Field>
                </>
              )}
              <Field label={addMode === "prevention" ? "統制確認の根拠" : "観測の手がかり"} name="observation_clues" hint="記録・文書で確かめられる具体的な根拠を書く">
                <Textarea id="observation_clues" name="observation_clues" required maxLength={1200} rows={3} placeholder="契約、議事録、定款、報道などで確認できる根拠" />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11" onClick={() => setAddOpen(false)}>閉じる</Button>
              <Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="animate-spin" />}全PJへ追加</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editFactor)} onOpenChange={(open) => !open && setEditFactor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl">
          {editFactor && (
            <form key={`${editFactor.killerFactorId}-${editFactor.recordedAt || "new"}`} onSubmit={(event) => void saveState(event)}>
              <DialogHeader>
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${editFactor.operatingMode === "prevention" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                    {modeLabel(editFactor.operatingMode)}
                  </span>
                  <span className="text-xs text-slate-500">{editFactor.factorType}</span>
                </div>
                <DialogTitle>このPJの状態を更新</DialogTitle>
                <DialogDescription>{editFactor.eventDescription}</DialogDescription>
              </DialogHeader>
              <div className="my-5 grid gap-4">
                {editFactor.operatingMode === "prevention" && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-950">
                    <div className="font-semibold">先に完了させること</div>
                    <div className="mt-0.5">{editFactor.preventiveAction}</div>
                    {editFactor.timingGuidance && <div className="mt-1 text-[11px] text-blue-700">期限目安: {editFactor.timingGuidance}</div>}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700">状態</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(editFactor.operatingMode === "prevention" ? PREVENTION_STATUSES : MONITORING_STATUSES)
                      .filter((status) => status !== "unchecked")
                      .map((status) => {
                        const meta = STATUS_PRESENTATION[status];
                        const Icon = meta.icon;
                        return (
                          <button
                            key={status}
                            type="button"
                            aria-pressed={editingStatus === status}
                            onClick={() => setEditingStatus(status)}
                            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${editingStatus === status ? meta.className : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                          >
                            <Icon className="size-3.5" />{meta.label}
                          </button>
                        );
                      })}
                  </div>
                </div>
                <div className={`grid gap-4 ${editFactor.operatingMode === "prevention" ? "sm:grid-cols-2" : ""}`}>
                  <Field label="状態日" name="status_on">
                    <Input id="status_on" name="status_on" type="date" required defaultValue={editFactor.statusOn || todayInJapan()} className="h-11" />
                  </Field>
                  {editFactor.operatingMode === "prevention" && (
                    <Field label="PJ目標日（任意）" name="target_on" hint="日付まで確定している場合だけ入れる">
                      <Input id="target_on" name="target_on" type="date" defaultValue={editFactor.targetOn || ""} className="h-11" />
                    </Field>
                  )}
                </div>
                <Field
                  label="根拠メモ"
                  name="evidence_note"
                  hint={editFactor.operatingMode === "monitoring" ? "CEO本人の自己申告だけでは平常・兆候・発生を確定しない" : "契約・定款・議事録など、統制の実装状態を確認できる文書を残す"}
                >
                  <Textarea
                    id="evidence_note"
                    name="evidence_note"
                    required
                    maxLength={2000}
                    rows={5}
                    defaultValue={editFactor.evidenceNote || ""}
                    placeholder={editFactor.operatingMode === "monitoring" ? "議事録・契約・報道など、何を確認してこの状態にしたか" : "SHA・定款・取締役会議事録など、統制の現在地を示す根拠"}
                  />
                </Field>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                  保存後の全体判定は状態件数から即時更新する。自動通知・成功確率の再計算・LLM呼び出しは行わない。
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="h-11" onClick={() => setEditFactor(null)}>閉じる</Button>
                <Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="animate-spin" />}状態を保存</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
