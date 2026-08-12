import type { SupabaseClient } from "@supabase/supabase-js";

export type ReimbursementDecisionAction =
  | "reimb_approve"
  | "reimb_reject"
  | "reimb_admin_approve"
  | "reimb_admin_reject";

const PM_ACTIONS = new Set<ReimbursementDecisionAction>(["reimb_approve", "reimb_reject"]);
const ADMIN_ACTIONS = new Set<ReimbursementDecisionAction>(["reimb_admin_approve", "reimb_admin_reject"]);
const PM_APPROVED_STATUSES = new Set(["pmApproved", "pmapproved"]);

export class ReimbursementDecisionError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export async function applyReimbursementDecision(
  db: SupabaseClient,
  input: {
    reimbursementId: string;
    action: ReimbursementDecisionAction;
    approverEmail: string;
  },
) {
  const reimbursementId = input.reimbursementId.trim();
  const approverEmail = input.approverEmail.trim().toLowerCase();
  const action = input.action;

  if (!reimbursementId) throw new ReimbursementDecisionError("reimbursementId が空");
  if (!PM_ACTIONS.has(action) && !ADMIN_ACTIONS.has(action)) {
    throw new ReimbursementDecisionError(`未知の action: ${action}`);
  }
  if (!approverEmail) throw new ReimbursementDecisionError("承認者メールを確認できなかった");

  const { data: member, error: memberError } = await db
    .from("members")
    .select("member_id, is_admin, status")
    .eq("email", approverEmail)
    .maybeSingle();
  if (memberError) throw new ReimbursementDecisionError(memberError.message, 500);
  if (!member || String(member.status ?? "") !== "active") {
    throw new ReimbursementDecisionError("メンバー未登録または非アクティブ", 403);
  }

  const { data: row, error: rowError } = await db
    .from("reimbursements")
    .select("reimbursement_id, project_id, project_name, status, amount")
    .eq("reimbursement_id", reimbursementId)
    .maybeSingle();
  if (rowError) throw new ReimbursementDecisionError(rowError.message, 500);
  if (!row) throw new ReimbursementDecisionError("立替が見つからない", 404);

  const currentStatus = String(row.status ?? "");
  const now = new Date().toISOString();
  let patch: Record<string, unknown>;
  let label: string;

  if (PM_ACTIONS.has(action)) {
    const { data: pmRow, error: pmError } = await db
      .from("project_members")
      .select("project_id")
      .eq("member_id", member.member_id)
      .eq("project_id", row.project_id)
      .eq("is_active", true)
      .eq("is_pm", true)
      .maybeSingle();
    if (pmError) throw new ReimbursementDecisionError(pmError.message, 500);
    if (!pmRow) throw new ReimbursementDecisionError("このPJのPMではない", 403);
    if (currentStatus !== "submitted") {
      throw new ReimbursementDecisionError(`PM承認は申請中のときだけ (現在: ${currentStatus})`, 409);
    }

    patch = action === "reimb_approve"
      ? {
          status: "pmApproved",
          pm_approved_by: approverEmail,
          pm_approved_at: now,
          admin_approved_by: null,
          admin_approved_at: null,
          updated_at: now,
        }
      : {
          status: "rejected",
          pm_approved_by: null,
          pm_approved_at: null,
          admin_approved_by: null,
          admin_approved_at: null,
          updated_at: now,
        };
    label = action === "reimb_approve" ? "PM承認済み（admin待ち）" : "PM差戻し";
  } else {
    if (!member.is_admin) throw new ReimbursementDecisionError("admin ではない", 403);
    if (!PM_APPROVED_STATUSES.has(currentStatus)) {
      throw new ReimbursementDecisionError(`admin承認はPM承認済みのときだけ (現在: ${currentStatus})`, 409);
    }
    patch = action === "reimb_admin_approve"
      ? { status: "approved", admin_approved_by: approverEmail, admin_approved_at: now, updated_at: now }
      : { status: "rejected", admin_approved_by: null, admin_approved_at: null, updated_at: now };
    label = action === "reimb_admin_approve" ? "admin承認済み" : "admin却下";
  }

  const update = db
    .from("reimbursements")
    .update(patch)
    .eq("reimbursement_id", reimbursementId);
  const { data: updated, error: updateError } = PM_APPROVED_STATUSES.has(currentStatus)
    ? await update.in("status", Array.from(PM_APPROVED_STATUSES)).select("reimbursement_id, status").maybeSingle()
    : await update.eq("status", currentStatus).select("reimbursement_id, status").maybeSingle();
  if (updateError) throw new ReimbursementDecisionError(updateError.message, 500);
  if (!updated) throw new ReimbursementDecisionError("状態が先に変わったため反映しなかった。再読み込みしてね", 409);

  return {
    message: label,
    status: String(updated.status),
    projectName: row.project_name || row.project_id,
  };
}
