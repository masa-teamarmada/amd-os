import type { ReactNode } from "react";
import { Ban, CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";
import type {
  SxBallSide,
  SxDatePrecision,
  SxInteractionKind,
  SxMilestoneStatus,
  SxPartnerInteraction,
  SxTrackKey,
} from "@/lib/sx-management";

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
  return !value.trim() || value.includes("未確認") || value.includes("未設定") || value.includes("未登録");
}

export function sxTechnicalTestStatusLabel(value: string) {
  return ({ unassessed: "未評価", planned: "計画", running: "実施中", passed: "合格", failed: "不合格", blocked: "停止" } as Record<string, string>)[value] || "未確認";
}

export const SX_TECH_TEST_STATUS_TONE: Record<string, string> = {
  unassessed: "border-[#b8b5c8] bg-[#eeedf4] text-[#55506d]",
  planned: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
  running: "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]",
  passed: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  failed: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
  blocked: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
};

/** milestone.progressPct is meaningless while status is unassessed; never render a bare 0%. */
export function sxProgressDisplay(status: SxMilestoneStatus, progressPct: number) {
  return status === "unassessed" ? "未評価" : `${progressPct}%`;
}

export function sxFormatDelta(deltaDays: number | null, dateCertainty: "confirmed" | "provisional" | null) {
  if (deltaDays == null) return "差分未算定";
  if (dateCertainty === "provisional") return deltaDays === 0 ? "予測差 0日" : `予測差 ${deltaDays > 0 ? "+" : "-"}${Math.abs(deltaDays)}日`;
  if (deltaDays === 0) return "予定通り";
  return deltaDays > 0 ? `${deltaDays}日遅延` : `${Math.abs(deltaDays)}日短縮`;
}

/** Evidence completeness for a pillar's signal strip: owner / completion criteria / measured KPI / verified confidence. Never averages progress_pct into this. */
export function sxTrackEvidenceCompleteness(
  track: { key: string; ownerLabel: string; lastVerifiedAt: string | null; confidence: string },
  milestone: { completionCriteria: string } | undefined,
  kpis: Array<{ track: string; actual: number | null; measurementDate: string | null }>,
) {
  const kpiForTrack = kpis.filter((kpi) => kpi.track === track.key);
  const checks = [
    !sxIsMissingOwner(track.ownerLabel),
    Boolean(milestone?.completionCriteria && !milestone.completionCriteria.includes("未確認")),
    kpiForTrack.some((kpi) => kpi.actual != null && Boolean(kpi.measurementDate)),
    Boolean(track.lastVerifiedAt) && track.confidence !== "unknown",
  ];
  const filled = checks.filter(Boolean).length;
  return { pct: Math.round((filled / checks.length) * 100), filled, total: checks.length };
}

/** Retired geography-based labels are normalized and demoted at the display boundary. */
const SX_PARTNER_DISPLAY_OVERRIDES: Record<string, { displayName: string; lowPriority: boolean }> = {
  "fc-hokuriku": { displayName: "ファインケム", lowPriority: true },
};

export function sxPartnerDisplay(partner: { slug: string; name: string }) {
  const override = SX_PARTNER_DISPLAY_OVERRIDES[partner.slug];
  return { name: override?.displayName || partner.name, lowPriority: override?.lowPriority ?? false };
}

export function sxPartnerName(partner: { slug: string; name: string }) {
  return sxPartnerDisplay(partner).name;
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
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${tone}`}>{children}</span>;
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

const BALL_SIDE_LABEL: Record<SxBallSide, string> = {
  sx: "SX側",
  partner: "相手側",
  shared: "双方",
  none: "該当なし",
  unknown: "未確認",
};

export function sxBallSideLabel(side: SxBallSide) {
  return BALL_SIDE_LABEL[side] || "未確認";
}

const INTERACTION_KIND_LABEL: Record<SxInteractionKind, string> = {
  meeting: "面談",
  email: "メール",
  agreement: "合意",
  deliverable: "成果物",
  handoff: "引き継ぎ",
  status_update: "状況更新",
  note: "メモ",
};

export function sxInteractionKindLabel(kind: SxInteractionKind) {
  return INTERACTION_KIND_LABEL[kind] || "記録";
}

/** month precision never fabricates a day; unknown precision never fabricates a date at all. */
export function sxFormatDueDateWithPrecision(dueDate: string | null, precision: SxDatePrecision) {
  if (precision === "unknown" || !dueDate) return "期限未設定";
  const [year, month] = dueDate.slice(0, 7).split("-");
  if (precision === "month") return `${year}年${Number(month)}月（日付未確認）`;
  const day = dueDate.slice(8, 10);
  return `${year}/${Number(month)}/${Number(day)}`;
}

/** Same contract as sxFormatDueDateWithPrecision but for interaction event dates (no "期限" wording). */
export function sxFormatEventDateWithPrecision(occurredOn: string | null, precision: SxDatePrecision) {
  if (precision === "unknown" || !occurredOn) return "日付未確認";
  const [year, month] = occurredOn.slice(0, 7).split("-");
  if (precision === "month") return `${year}年${Number(month)}月（日付未確認）`;
  const day = occurredOn.slice(8, 10);
  return `${year}/${Number(month)}/${Number(day)}`;
}

/** Effective recency key for an interaction: the confirmed occurredOn date, or — when the date is
 * unconfirmed — the date it was recorded (createdAt sliced to YYYY-MM-DD). An unknown-dated
 * interaction is ranked by when SX became aware of it (recorded time), not assumed to be newer
 * than every known-dated one: a future-dated known interaction still outranks it. */
function sxInteractionRecencyKey(interaction: SxPartnerInteraction): string {
  return interaction.occurredOn ?? interaction.createdAt.slice(0, 10);
}

export function sxSortInteractionsByRecency(interactions: SxPartnerInteraction[]): SxPartnerInteraction[] {
  return [...interactions].sort(
    (a, b) => sxInteractionRecencyKey(b).localeCompare(sxInteractionRecencyKey(a)) || b.createdAt.localeCompare(a.createdAt),
  );
}

export function sxLatestInteraction(interactions: SxPartnerInteraction[]): SxPartnerInteraction | null {
  return sxSortInteractionsByRecency(interactions)[0] || null;
}
