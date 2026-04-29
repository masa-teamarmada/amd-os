import type {
  BillingRow,
  MilestoneRow,
  ProtocolRow,
  ProjectSummary,
  ActionItem,
  HeaderKPIs,
} from "@/types/dashboard";
import { currentDayJST } from "./format";

export function buildProjectSummaries(
  billing: BillingRow[],
  milestones: MilestoneRow[],
  protocols: ProtocolRow[]
): ProjectSummary[] {
  const codes = new Set<string>();
  billing.forEach((b) => codes.add(b.project_code));
  milestones.forEach((m) => codes.add(m.project_code));
  protocols.forEach((p) => codes.add(p.project_code));

  return Array.from(codes)
    .sort()
    .map((code) => {
      const b = billing.find((x) => x.project_code === code);
      const ms = milestones.filter((x) => x.project_code === code);
      const ps = protocols.filter((x) => x.project_code === code);

      // Weighted MS progress
      const totalPt = ms.reduce((s, m) => s + m.points, 0);
      const weightedPct =
        totalPt > 0
          ? ms.reduce(
              (s, m) => s + (m.progress_pct ?? 0) * m.points,
              0
            ) / totalPt
          : 0;

      // Health
      let health: ProjectSummary["health"] = "blue";
      if (b?.status === "paid" || b?.status === "closed") health = "green";
      if (b?.status === "open" && currentDayJST() > 10) health = "amber";
      const hasOverdueMs = ms.some(
        (m) =>
          m.target_ym &&
          m.target_ym < (b?.ym ?? "") &&
          (m.progress_pct ?? 0) < 50
      );
      if (hasOverdueMs) health = "red";

      return {
        project_code: code,
        project_name:
          b?.project_name ??
          ms[0]?.project_name ??
          ps[0]?.project_name ??
          code,
        billing_status: b?.status ?? "—",
        budget_total: b?.budget_total ?? null,
        ms_progress_avg: Math.round(weightedPct),
        active_ms_count: ms.length,
        protocol_count: ps.length,
        next_meeting: b?.meeting_at ?? null,
        health,
      };
    });
}

export function deriveActionItems(
  billing: BillingRow[],
  milestones: MilestoneRow[],
  protocols: ProtocolRow[],
  currentYm: string
): ActionItem[] {
  const items: ActionItem[] = [];
  const day = currentDayJST();

  for (const b of billing) {
    if (b.status === "open" && day > 10) {
      items.push({
        severity: "high",
        type: "billing",
        project_code: b.project_code,
        description: `Billing still open (day ${day})`,
      });
    }
    if (b.status === "budgeted" && !b.invoice_sent_at && day > 15) {
      items.push({
        severity: "medium",
        type: "billing",
        project_code: b.project_code,
        description: "Invoice not sent yet",
      });
    }
    if (b.meeting_skipped) {
      items.push({
        severity: "medium",
        type: "meeting",
        project_code: b.project_code,
        description: "Monthly meeting skipped",
      });
    }
  }

  for (const m of milestones) {
    if (m.target_ym && m.target_ym <= currentYm && (m.progress_pct ?? 0) < 50) {
      items.push({
        severity: "high",
        type: "milestone",
        project_code: m.project_code,
        description: `${m.milestone_title} — ${m.progress_pct ?? 0}% (target: ${m.target_ym})`,
      });
    }
  }

  for (const p of protocols) {
    if (p.importance === "high" && p.status === "pending") {
      items.push({
        severity: "high",
        type: "protocol",
        project_code: p.project_code,
        description: `Decision needed: ${p.decision_point}`,
      });
    }
  }

  return items.sort((a, b) =>
    a.severity === "high" && b.severity !== "high" ? -1 : 0
  );
}

export function calculateKPIs(
  billing: BillingRow[],
  milestones: MilestoneRow[],
  currentYm: string
): HeaderKPIs {
  const codes = new Set<string>();
  billing.forEach((b) => codes.add(b.project_code));
  milestones.forEach((m) => codes.add(m.project_code));

  const pipelineYen = billing.reduce(
    (s, b) => s + (b.budget_total ?? 0),
    0
  );

  return {
    current_ym: currentYm,
    project_count: codes.size,
    active_ms_count: milestones.length,
    billing_pipeline_yen: pipelineYen,
  };
}
