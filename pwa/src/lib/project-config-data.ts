/**
 * Project Config (PJ 設定画面) data layer.
 *
 * GAS 042_ProjectConfig_Api.js の PWA 移植版。
 * /project/[projectId]/config から呼ばれる。
 *
 * 設計: HANDOFF_pwa_rebuild.md / GAS 226_ProjectConfig.html
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"
);

// ============================================================
// 型定義
// ============================================================

export interface ProjectConfigProject {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string | null;
  status: string;
  reportEmails: string | null;
  startYm: string | null;
  endYm: string | null;
  feeType: string | null;
  feeAmount: number | null;
  invoiceSendDeadlineRule: string | null;
  paymentDueRule: string | null;
  invoiceSendManual: boolean;
  invoiceToEmails: string | null;
  invoiceCcEmails: string | null;
  invoiceBccEmails: string | null;
  freeePartnerId: string | null;
  slackChannelId: string | null;
  driveFolderId: string | null;
  pmName: string;
  closerName: string;
}

export interface ProjectConfigMember {
  id: string;
  memberId: string;
  memberName: string;
  codeName: string;
  email?: string | null;
  isPM: boolean;
  isCloser: boolean;
  isPL: boolean;
  roleLabel: string;
  joinYm: string;
  leaveYm: string;
  isActive: boolean;
}

export interface MemberMasterRow {
  memberId: string;
  memberName: string;
  codeName: string;
}

export interface ProjectConfigData {
  project: ProjectConfigProject;
  members: ProjectConfigMember[];
  memberMaster: MemberMasterRow[];
}

// ============================================================
// READ
// ============================================================

export async function fetchProjectConfig(projectId: string): Promise<ProjectConfigData | null> {
  const [{ data: pjRow }, { data: pmRows }, { data: memberRows }] = await Promise.all([
    supabase.from("projects").select("*").eq("project_id", projectId).maybeSingle(),
    supabase.from("project_members").select("*").eq("project_id", projectId),
    supabase
      .from("members")
      .select("member_id, member_name, code_name, status")
      .order("code_name", { ascending: true }),
  ]);

  if (!pjRow) return null;

  const allMembers = memberRows ?? [];
  const memberLookup = new Map<string, { name: string; code: string }>();
  for (const m of allMembers) {
    memberLookup.set(m.member_id, {
      name: m.member_name || m.code_name || m.member_id,
      code: m.code_name || "",
    });
  }

  const memberMaster: MemberMasterRow[] = allMembers
    .filter((m) => (m.status ?? "active") === "active")
    .map((m) => ({
      memberId: m.member_id,
      memberName: m.member_name || m.member_id,
      codeName: m.code_name || "",
    }));

  const members: ProjectConfigMember[] = (pmRows ?? []).map((row) => {
    const lookup = memberLookup.get(row.member_id);
    return {
      id: row.id,
      memberId: row.member_id,
      memberName: lookup?.name ?? row.member_id,
      codeName: lookup?.code ?? "",
      isPM: !!row.is_pm,
      isCloser: !!row.is_closer,
      isPL: !!row.is_pl,
      roleLabel: row.role_label ?? "",
      joinYm: row.join_ym ?? "",
      leaveYm: row.leave_ym ?? "",
      isActive: row.is_active !== false,
    };
  });

  const pmRow = members.find((m) => m.isPM);
  const closerRow = members.find((m) => m.isCloser);

  const project: ProjectConfigProject = {
    id: pjRow.id,
    projectId: pjRow.project_id,
    projectName: pjRow.project_name,
    clientName: pjRow.client_name ?? null,
    status: pjRow.status ?? "",
    reportEmails: pjRow.report_emails ?? null,
    startYm: pjRow.start_ym ?? null,
    endYm: pjRow.end_ym ?? null,
    feeType: pjRow.fee_type ?? null,
    feeAmount: pjRow.fee_amount != null ? Number(pjRow.fee_amount) : null,
    invoiceSendDeadlineRule: pjRow.invoice_send_deadline_rule ?? null,
    paymentDueRule: pjRow.payment_due_rule ?? null,
    invoiceSendManual: !!pjRow.invoice_send_manual,
    invoiceToEmails: pjRow.invoice_to_emails ?? null,
    invoiceCcEmails: pjRow.invoice_cc_emails ?? null,
    invoiceBccEmails: pjRow.invoice_bcc_emails ?? null,
    freeePartnerId: pjRow.freee_partner_id ?? null,
    slackChannelId: pjRow.slack_channel_id ?? null,
    driveFolderId: pjRow.drive_folder_id ?? null,
    pmName: pmRow?.codeName || pmRow?.memberName || "",
    closerName: closerRow?.codeName || closerRow?.memberName || "",
  };

  return { project, members, memberMaster };
}

// ============================================================
// WRITE
// ============================================================

export interface SaveProjectPatch {
  status?: string;
  reportEmails?: string | null;
  startYm?: string | null;
  endYm?: string | null;
  feeType?: string | null;
  feeAmount?: number | null;
  invoiceSendDeadlineRule?: string | null;
  paymentDueRule?: string | null;
  invoiceSendManual?: boolean;
  invoiceToEmails?: string | null;
  invoiceCcEmails?: string | null;
  invoiceBccEmails?: string | null;
}

export async function saveProjectConfig(
  projectUuid: string,
  patch: SaveProjectPatch
): Promise<{ ok: boolean; message?: string }> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.reportEmails !== undefined) dbPatch.report_emails = patch.reportEmails;
  if (patch.startYm !== undefined) dbPatch.start_ym = patch.startYm;
  if (patch.endYm !== undefined) dbPatch.end_ym = patch.endYm;
  if (patch.feeType !== undefined) dbPatch.fee_type = patch.feeType;
  if (patch.feeAmount !== undefined) dbPatch.fee_amount = patch.feeAmount;
  if (patch.invoiceSendDeadlineRule !== undefined) dbPatch.invoice_send_deadline_rule = patch.invoiceSendDeadlineRule;
  if (patch.paymentDueRule !== undefined) dbPatch.payment_due_rule = patch.paymentDueRule;
  if (patch.invoiceSendManual !== undefined) dbPatch.invoice_send_manual = patch.invoiceSendManual;
  if (patch.invoiceToEmails !== undefined) dbPatch.invoice_to_emails = patch.invoiceToEmails;
  if (patch.invoiceCcEmails !== undefined) dbPatch.invoice_cc_emails = patch.invoiceCcEmails;
  if (patch.invoiceBccEmails !== undefined) dbPatch.invoice_bcc_emails = patch.invoiceBccEmails;

  const { error } = await supabase.from("projects").update(dbPatch).eq("id", projectUuid);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export interface MemberInput {
  memberId: string;
  isPM: boolean;
  isCloser: boolean;
  isPL: boolean;
  roleLabel: string;
  joinYm: string;
  leaveYm: string;
  isActive: boolean;
}

/**
 * project_members を全件差し替え保存 (GAS の saveMembers と同じ「全削除→挿入」方式)
 */
export async function saveProjectMembers(
  projectId: string,
  members: MemberInput[]
): Promise<{ ok: boolean; message?: string; saved: number }> {
  // 1) 既存の該当 PJ 行を全削除
  const { error: delErr } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId);
  if (delErr) return { ok: false, message: delErr.message, saved: 0 };

  // 2) 新規行を挿入 (memberId が空の行はスキップ)
  const rows = members
    .filter((m) => m.memberId.trim().length > 0)
    .map((m) => ({
      project_id: projectId,
      member_id: m.memberId.trim(),
      is_pm: m.isPM,
      is_closer: m.isCloser,
      is_pl: m.isPL,
      role_label: m.roleLabel.trim() || null,
      join_ym: m.joinYm.trim() || null,
      leave_ym: m.leaveYm.trim() || null,
      is_active: m.isActive,
    }));

  if (rows.length === 0) return { ok: true, saved: 0 };

  const { error: insErr } = await supabase.from("project_members").insert(rows);
  if (insErr) return { ok: false, message: insErr.message, saved: 0 };
  return { ok: true, saved: rows.length };
}
