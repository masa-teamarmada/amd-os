"use client";

import { useState, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * 会社概要タブと資本政策表タブが共有する表示プリミティブとフォーマッタ。
 * 2026-08-29 に資本政策表を独立タブへ切り出したとき、両方から使うものだけをここへ移した。
 * 画面固有のロジックは持たせない。
 */

export function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value || "").replaceAll(",", "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function textOrNull(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

export function formatYen(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  if (Math.abs(number) >= 100_000_000) return `${(number / 100_000_000).toLocaleString("ja-JP", { maximumFractionDigits: 2 })}億円`;
  if (Math.abs(number) >= 10_000) return `${(number / 10_000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万円`;
  return `${number.toLocaleString("ja-JP")}円`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "日付未入力";
  return value.replaceAll("-", "/");
}

export function statusLabel(value: string | null | undefined) {
  return ({ draft: "下書き", final: "確定", filed: "申告済み", planned: "計画", confirmed: "確定", void: "取消" } as Record<string, string>)[value || ""] || value || "未入力";
}

export function Section({ title, description, action, children, className = "" }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
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

export function InfoCell({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:px-5 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-900">{value || <span className="text-slate-400">未入力</span>}</div>
    </div>
  );
}

export function Field({ label, name, children, hint }: { label: string; name?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs text-slate-700">{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-4 text-slate-500">{hint}</p>}
    </div>
  );
}

export function NativeSelect({ name, defaultValue, options, className = "" }: { name: string; defaultValue?: string; options: { value: string; label: string }[]; className?: string }) {
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

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-5 py-8 text-center text-sm leading-6 text-slate-500">{children}</div>;
}
