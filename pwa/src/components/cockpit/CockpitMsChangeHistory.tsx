"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, CircleMinus, CirclePlus, History, PencilLine, ShieldCheck } from "lucide-react";
import type { MilestoneChangeField, MilestoneChangeHistory, MilestoneChangeItem, MilestoneResponsibilityChange } from "@/lib/supabase-data";

type Props = {
  history: MilestoneChangeHistory[] | null | undefined;
  memberMap: Record<string, string>;
};

const yenFormatter = new Intl.NumberFormat("ja-JP");
const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatYen(value: number) {
  return `¥${yenFormatter.format(Math.round(value || 0))}`;
}

function formatShare(value: number | null) {
  if (value == null) return "なし";
  return `${Math.round(value * 1000) / 10}%`;
}

function formatDate(value: string) {
  if (!value) return "日時不明";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

function displayActor(email: string | null) {
  if (!email) return "記録者不明";
  return email.split("@")[0] || "記録者不明";
}

function formatFieldValue(value: MilestoneChangeField["beforeValue"]) {
  if (value == null || value === "") return "なし";
  if (typeof value === "boolean") return value ? "有効" : "無効";
  return String(value);
}

function statusTone(status: MilestoneChangeHistory["rewardPreviewStatus"]) {
  if (status === "blocked") {
    return { label: "保存停止", className: "border-red-200 bg-red-50 text-red-800", Icon: AlertTriangle };
  }
  if (status === "warning") {
    return { label: "差額あり", className: "border-amber-200 bg-amber-50 text-amber-800", Icon: AlertTriangle };
  }
  if (status === "safe") {
    return { label: "検算済み", className: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: ShieldCheck };
  }
  return { label: "未検算", className: "border-slate-200 bg-slate-50 text-slate-600", Icon: ShieldCheck };
}

function kindMeta(kind: MilestoneChangeItem["kind"]) {
  if (kind === "added") return { label: "追加", Icon: CirclePlus, className: "text-emerald-700 bg-emerald-50 border-emerald-100" };
  if (kind === "removed") return { label: "無効化", Icon: CircleMinus, className: "text-red-700 bg-red-50 border-red-100" };
  return { label: "変更", Icon: PencilLine, className: "text-slate-700 bg-slate-50 border-slate-200" };
}

function ResponsibilityLine({
  change,
  memberMap,
}: {
  change: MilestoneResponsibilityChange;
  memberMap: Record<string, string>;
}) {
  const memberName = memberMap[change.memberId] || change.memberId;
  const shareChanged = change.beforeShare !== change.afterShare;
  const taskChanged = (change.beforeTaskDescription || "") !== (change.afterTaskDescription || "");
  return (
    <div className="rounded-md border border-[#f0f0f2] bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#1d1d1f]">
        <span>{memberName}</span>
        <span className="rounded-sm bg-[#f5f5f7] px-1.5 py-0.5 text-[#6e6e73]">{change.role}</span>
        {shareChanged && (
          <span className="tabular-nums text-[#6e6e73]">
            {formatShare(change.beforeShare)} → {formatShare(change.afterShare)}
          </span>
        )}
      </div>
      {taskChanged && (
        <div className="mt-1 grid gap-1 text-[11px] leading-relaxed text-[#6e6e73] sm:grid-cols-2">
          <div className="min-w-0 break-words rounded-sm bg-[#fafafa] px-2 py-1">
            <span className="font-semibold text-[#86868b]">前</span> {change.beforeTaskDescription || "なし"}
          </div>
          <div className="min-w-0 break-words rounded-sm bg-[#fafafa] px-2 py-1">
            <span className="font-semibold text-[#86868b]">後</span> {change.afterTaskDescription || "なし"}
          </div>
        </div>
      )}
    </div>
  );
}

function ChangeItemBlock({
  item,
  memberMap,
}: {
  item: MilestoneChangeItem;
  memberMap: Record<string, string>;
}) {
  const meta = kindMeta(item.kind);
  const Icon = meta.Icon;
  return (
    <div className="rounded-lg border border-[#e5e5e7] bg-[#fafafa] p-3">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold ${meta.className}`}>
          <Icon className="size-3.5" aria-hidden="true" />
          {meta.label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="break-words text-[13px] font-semibold text-[#1d1d1f]">{item.title}</div>
          {item.fields.length > 0 && (
            <div className="mt-2 grid gap-1.5">
              {item.fields.map((field) => (
                <div key={`${item.milestoneId}-${field.field}`} className="grid gap-1 text-[11px] leading-relaxed text-[#6e6e73] sm:grid-cols-[76px_minmax(0,1fr)]">
                  <div className="font-semibold text-[#86868b]">{field.label}</div>
                  <div className="min-w-0 break-words">
                    <span>{formatFieldValue(field.beforeValue)}</span>
                    <span className="px-1.5 text-[#a1a1a6]">→</span>
                    <span className="font-medium text-[#1d1d1f]">{formatFieldValue(field.afterValue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {item.responsibilities.length > 0 && (
            <div className="mt-2 grid gap-1.5">
              {item.responsibilities.map((change, index) => (
                <ResponsibilityLine
                  key={`${item.milestoneId}-${change.memberId}-${change.role}-${index}`}
                  change={change}
                  memberMap={memberMap}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CockpitMsChangeHistory({ history, memberMap }: Props) {
  const [expanded, setExpanded] = useState(false);
  const events = history ?? [];
  const latest = events[0] ?? null;

  return (
    <section className="rounded-xl border border-[#e5e5e7] bg-white">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fafafa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
        aria-expanded={expanded}
        title="MS変更履歴を開閉"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#3c3c43]">
          <History className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-[#1d1d1f]">MS変更履歴</span>
          <span className="mt-0.5 block truncate text-[11px] text-[#86868b]">
            {latest ? `${formatDate(latest.changedAt)} / ${latest.changedMilestoneCount}件変更` : "まだ記録なし"}
          </span>
        </span>
        <span className="rounded-md bg-[#f5f5f7] px-2 py-1 text-[11px] font-semibold text-[#6e6e73]">
          {events.length}件
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-[#86868b] transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="border-t border-[#f0f0f2] px-4 py-3">
          {events.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#d6d6da] bg-[#fafafa] px-3 py-4 text-[12px] text-[#86868b]">
              まだMS変更履歴はありません。
            </div>
          ) : (
            <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
              {events.map((event) => {
                const tone = statusTone(event.rewardPreviewStatus);
                const StatusIcon = tone.Icon;
                return (
                  <article key={event.id} className="rounded-lg border border-[#e5e5e7] bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#f0f0f2] px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#1d1d1f]">{formatDate(event.changedAt)}</div>
                        <div className="mt-0.5 text-[11px] text-[#86868b]">記録者 {displayActor(event.changedByEmail)}</div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${tone.className}`}>
                          <StatusIcon className="size-3.5" aria-hidden="true" />
                          {tone.label}
                        </span>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700">
                          変更 {event.changedMilestoneCount}
                        </span>
                        {event.positiveOffsetYen > 0 && (
                          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                            追加 {formatYen(event.positiveOffsetYen)}
                          </span>
                        )}
                        {event.negativeOffsetYen < 0 && (
                          <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800">
                            回収 {formatYen(Math.abs(event.negativeOffsetYen))}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 p-3">
                      {event.changeItems.map((item) => (
                        <ChangeItemBlock key={`${event.id}-${item.milestoneId}-${item.kind}`} item={item} memberMap={memberMap} />
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
