import type { ReactNode } from "react";
import { Ban, CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";
import type { SxMilestoneStatus, SxTrackKey } from "@/lib/sx-management";

export const SX_TRACK_LABELS: Record<SxTrackKey, string> = {
  business_development: "事業開発",
  technology_development: "技術開発",
  funding: "資金調達",
  organizational_building: "体制構築",
};

export const SX_STATUS_LABEL: Record<SxMilestoneStatus, string> = {
  unassessed: "未評価",
  on_track: "順調",
  attention: "注意",
  at_risk: "遅れ懸念",
  blocked: "停止",
  completed: "完了",
};

export const SX_STATUS_TONE: Record<string, string> = {
  on_track: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  attention: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  at_risk: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  blocked: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
  completed: "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]",
  unassessed: "border-[#b8b5c8] bg-[#eeedf4] text-[#55506d]",
};

export function sxFormatDate(value: string | null | undefined, fallback = "未設定") {
  if (!value) return fallback;
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return fallback;
  return `${year}/${Number(month)}/${Number(day)}`;
}

export function sxConfidenceLabel(value: string | null | undefined) {
  return ({ high: "高", medium: "中", low: "低", unknown: "未確認" } as Record<string, string>)[value || "unknown"] || "未確認";
}

export function sxDisplayText(value: string | null | undefined) {
  return value?.replace(/\brunway\b/gi, "資金残存月数") || "";
}

export function sxAddDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function sxIsMissingOwner(value: string) {
  return !value.trim() || value.includes("未確認") || value.includes("未設定");
}

/** Month position (0..monthCount) of a YYYY-MM-DD date within a 9-month horizon, with in-month fraction. */
export function sxMonthPosition(dateStr: string | null | undefined, horizonMonths: string[]) {
  if (!dateStr) return null;
  const ym = dateStr.slice(0, 7);
  const day = Number(dateStr.slice(8, 10)) || 1;
  const fraction = Math.min(1, Math.max(0, (day - 1) / 30));
  const index = horizonMonths.findIndex((month) => month === ym);
  if (index >= 0) return index + fraction;
  if (ym < horizonMonths[0]) return 0;
  return horizonMonths.length;
}

export function SxBadge({ children, tone = "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]" }: { children: ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${tone}`}>{children}</span>;
}

export function SxStatusIcon({ status, blocked, className = "h-4 w-4" }: { status: SxMilestoneStatus; blocked?: boolean; className?: string }) {
  if (blocked || status === "blocked") return <Ban className={className} aria-hidden="true" />;
  if (status === "on_track" || status === "completed") return <CircleCheck className={className} aria-hidden="true" />;
  if (status === "attention" || status === "at_risk") return <TriangleAlert className={className} aria-hidden="true" />;
  return <CircleHelp className={className} aria-hidden="true" />;
}

/** Small inline diamond marker: filled=confirmed reading, dashed=provisional date, hollow=unknown confidence. */
export function SxDiamondMark({ dashed, hollow, tone = "#3d382c", className = "" }: { dashed?: boolean; hollow?: boolean; tone?: string; className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 ${className}`} aria-hidden="true">
      <polygon points="6,0.5 11.5,6 6,11.5 0.5,6" fill={hollow ? "none" : tone} stroke={tone} strokeWidth="1.4" strokeDasharray={dashed ? "2 1.6" : undefined} />
    </svg>
  );
}

export function SxTickMark({ tone = "#3d382c", className = "" }: { tone?: string; className?: string }) {
  return <span className={`inline-block h-3.5 w-[2px] shrink-0 ${className}`} style={{ background: tone }} aria-hidden="true" />;
}
