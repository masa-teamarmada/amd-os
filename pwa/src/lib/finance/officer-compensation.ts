import type { SupabaseClient } from "@supabase/supabase-js";
import { candidateSourceYmsForPaymentYm, effectivePaymentYmForCycle, type PaymentProjectRow } from "@/lib/payment-groups";

export type FinanceOfficerReserve = {
  ym: string;
  totalYen: number;
  entries: Array<{
    projectId: string;
    projectName: string;
    sourceYm: string;
    memberId: string;
    memberName: string;
    amountYen: number;
  }>;
};

type RewardMemberRow = {
  memberId?: unknown;
  member_id?: unknown;
  memberName?: unknown;
  member_name?: unknown;
  totalPay?: unknown;
  total_pay?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRewardMembers(value: unknown): RewardMemberRow[] {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      return asRewardMembers(JSON.parse(value));
    } catch {
      return [];
    }
  }
  const record = asRecord(value);
  return Array.isArray(record?.members) ? (record.members as RewardMemberRow[]) : [];
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function yenValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * 支払月paymentYmで役員(is_officer=true)がadmin.payoutsの支払対象から除外された金額を集計する。
 * `/admin/finance` の「AMD運営費へ残る役員除外分」と freee週次会計照合の「役員報酬未消込」検出が
 * この1関数を共有正本にする（2箇所で計算式が乖離しないように）。
 */
export async function loadOfficerReserve(
  supabase: SupabaseClient,
  paymentYm: string
): Promise<FinanceOfficerReserve> {
  const candidateYms = candidateSourceYmsForPaymentYm(paymentYm);
  const [membersRes, projectsRes, explicitCyclesRes, unsetCyclesRes] = await Promise.all([
    supabase
      .from("members")
      .select("member_id, code_name, is_officer")
      .eq("is_officer", true)
      .eq("status", "active"),
    supabase
      .from("projects")
      .select("project_id, project_name, client_name, status, freee_partner_id, payment_due_rule, payment_due_day, invoice_send_deadline_rule"),
    supabase
      .from("billing_cycles")
      .select("project_id, ym, invoice_ym, invoice_issued_at, invoice_sent_at, reward_summary_json")
      .eq("invoice_ym", paymentYm),
    supabase
      .from("billing_cycles")
      .select("project_id, ym, invoice_ym, invoice_issued_at, invoice_sent_at, reward_summary_json")
      .in("ym", candidateYms)
      .is("invoice_ym", null),
  ]);

  if (membersRes.error || projectsRes.error || explicitCyclesRes.error || unsetCyclesRes.error) {
    return { ym: paymentYm, totalYen: 0, entries: [] };
  }

  const officerMap = new Map<string, string>();
  for (const member of membersRes.data ?? []) {
    officerMap.set(member.member_id, member.code_name || member.member_id);
  }
  const projectMap = new Map<string, PaymentProjectRow>();
  for (const project of (projectsRes.data ?? []) as PaymentProjectRow[]) {
    projectMap.set(project.project_id, project);
  }

  type Cycle = {
    project_id: string;
    ym: string;
    invoice_ym: string | null;
    invoice_issued_at?: string | null;
    invoice_sent_at?: string | null;
    reward_summary_json: unknown;
  };
  const cycleMap = new Map<string, Cycle>();
  for (const cycle of (explicitCyclesRes.data ?? []) as Cycle[]) {
    cycleMap.set(`${cycle.project_id}:${cycle.ym}`, cycle);
  }
  for (const cycle of (unsetCyclesRes.data ?? []) as Cycle[]) {
    const project = projectMap.get(cycle.project_id);
    if (effectivePaymentYmForCycle(cycle, project) === paymentYm) {
      cycleMap.set(`${cycle.project_id}:${cycle.ym}`, { ...cycle, invoice_ym: paymentYm });
    }
  }

  const entries: FinanceOfficerReserve["entries"] = [];
  for (const cycle of [...cycleMap.values()]) {
    const project = projectMap.get(cycle.project_id);
    for (const member of asRewardMembers(cycle.reward_summary_json)) {
      const memberId = textValue(member.memberId) || textValue(member.member_id);
      if (!officerMap.has(memberId)) continue;
      const amountYen = yenValue(member.totalPay ?? member.total_pay);
      if (amountYen <= 0) continue;
      entries.push({
        projectId: cycle.project_id,
        projectName: project?.project_name || cycle.project_id,
        sourceYm: cycle.ym,
        memberId,
        memberName: textValue(member.memberName) || textValue(member.member_name) || officerMap.get(memberId) || memberId,
        amountYen,
      });
    }
  }

  entries.sort((a, b) => {
    if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName, "ja");
    if (a.sourceYm !== b.sourceYm) return a.sourceYm.localeCompare(b.sourceYm);
    return a.memberName.localeCompare(b.memberName, "ja");
  });

  return {
    ym: paymentYm,
    totalYen: entries.reduce((sum, entry) => sum + entry.amountYen, 0),
    entries,
  };
}
