import type { HTMLAttributes, ReactNode } from "react";
import { amieListCategoryTone, amieListDelta, amieListStatus, type AmieListTone } from "@/lib/amie-list-signals";

export function AmieListStatus({ value, label, tone, className, ...props }: Omit<HTMLAttributes<HTMLSpanElement>,"children"> & { value?: string | null; label?: string | null; tone?: AmieListTone }) {
  const signal = amieListStatus(value, label, tone);
  return <span {...props} title={props.title ?? signal.label} className={`amie-list-status ${className ?? ""}`} data-tone={signal.tone}><span aria-hidden="true" className="amie-list-mark">{signal.mark}</span><span>{signal.label}</span></span>;
}

export function AmieListCategory({ value, children, className, ...props }: HTMLAttributes<HTMLSpanElement> & { value?: string | null; children?: ReactNode }) {
  return <span {...props} title={props.title ?? value ?? "未分類"} className={`amie-list-category ${className ?? ""}`} data-tone={amieListCategoryTone(value)}><span aria-hidden="true" className="amie-list-category-mark">◆</span><span>{children ?? (value || "未分類")}</span></span>;
}

export function AmieListDelta({ value, children, positiveMeaning, title }: { value: number | null | undefined; children?: ReactNode; positiveMeaning?: "increase" | "improve" | "worsen"; title?: string }) {
  const delta = amieListDelta(value, positiveMeaning);
  return <span className="amie-list-delta" data-tone={delta.tone} data-direction={delta.direction} title={title}><span aria-hidden="true">{delta.mark}</span>{children ?? (value == null ? "差分未確認" : `${value > 0 ? "+" : ""}${value.toLocaleString("ja-JP")}`)}</span>;
}

export function AmieListOverview({ items, label = "一覧の状態内訳" }: { items: Array<{ label: string; count: number; tone?: AmieListTone }>; label?: string }) {
  return <div className="amie-list-overview" aria-label={label}>{items.map(item => <span key={item.label} className="amie-list-overview-item" data-tone={item.tone ?? "neutral"}><strong>{item.count.toLocaleString("ja-JP")}</strong><AmieListStatus label={item.label} tone={item.tone ?? "neutral"}/></span>)}</div>;
}
