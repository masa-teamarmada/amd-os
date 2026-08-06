import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Slack の承認ボタンから立替の承認 / 却下を反映する受け口。
 *
 * 経緯: Slack のボタン押下は Cloud Run → GAS `doPost` → キュー → `slackInteractiveWorker` が処理する。
 * ただし GAS 側の `reimburseApplyDecision` は旧スプレッドシート `DB_Reimbursements` を書いており、
 * 現行の正本である Supabase `reimbursements` には一切反映されない。
 * そこで worker からこの API を呼ばせ、判定と書き込みを PWA 側 (= 正本) に一本化する。
 *
 * 認証: 共有シークレット。押した本人の判定は Slack から解決済みの email で行う。
 */

type DecisionAction = "reimb_approve" | "reimb_reject" | "reimb_admin_approve" | "reimb_admin_reject";

const PM_ACTIONS = new Set<string>(["reimb_approve", "reimb_reject"]);
const ADMIN_ACTIONS = new Set<string>(["reimb_admin_approve", "reimb_admin_reject"]);
const PM_APPROVED_STATUSES = new Set(["pmApproved", "pmapproved"]);

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.SLACK_DECISION_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-amd-slack-secret") || "";
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  return header === secret || bearer === secret;
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return fail("unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("body is not json");
  }

  const reimbursementId = String(body.reimbursementId ?? "").trim();
  const action = String(body.action ?? "").trim() as DecisionAction;
  const approverEmail = String(body.approverEmail ?? "").trim().toLowerCase();

  if (!reimbursementId) return fail("reimbursementId が空");
  if (!PM_ACTIONS.has(action) && !ADMIN_ACTIONS.has(action)) return fail(`未知の action: ${action}`);
  if (!approverEmail) return fail("Slack アカウントに紐づくメールが解決できなかった");

  try {
    const db = createAdminClient();

    const { data: member, error: memberError } = await db
      .from("members")
      .select("member_id, is_admin, status")
      .eq("email", approverEmail)
      .maybeSingle();
    if (memberError) return fail(memberError.message, 500);
    if (!member || String(member.status ?? "") !== "active") return fail(`メンバー未登録または非アクティブ: ${approverEmail}`, 403);

    const { data: row, error: rowError } = await db
      .from("reimbursements")
      .select("reimbursement_id, project_id, project_name, status, amount")
      .eq("reimbursement_id", reimbursementId)
      .maybeSingle();
    if (rowError) return fail(rowError.message, 500);
    if (!row) return fail(`立替が見つからない: ${reimbursementId}`, 404);

    const status = String(row.status ?? "");
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
      if (pmError) return fail(pmError.message, 500);
      if (!pmRow) return fail(`このPJのPMではない (${row.project_id})`, 403);
      if (status !== "submitted") return fail(`PM承認は申請中のときだけ (現在: ${status})`);

      patch = action === "reimb_approve"
        ? { status: "pmApproved", pm_approved_by: approverEmail, pm_approved_at: now, admin_approved_by: null, admin_approved_at: null, updated_at: now }
        : { status: "rejected", pm_approved_by: null, pm_approved_at: null, admin_approved_by: null, admin_approved_at: null, updated_at: now };
      label = action === "reimb_approve" ? "PM承認済み（admin待ち）" : "PM差戻し";
    } else {
      if (!member.is_admin) return fail("admin ではない", 403);
      if (!PM_APPROVED_STATUSES.has(status)) return fail(`admin承認はPM承認済みのときだけ (現在: ${status})`);

      patch = action === "reimb_admin_approve"
        ? { status: "approved", admin_approved_by: approverEmail, admin_approved_at: now, updated_at: now }
        : { status: "rejected", admin_approved_by: null, admin_approved_at: null, updated_at: now };
      label = action === "reimb_admin_approve" ? "admin承認済み" : "admin却下";
    }

    const { error: updateError } = await db
      .from("reimbursements")
      .update(patch)
      .eq("reimbursement_id", reimbursementId);
    if (updateError) return fail(updateError.message, 500);

    return NextResponse.json({ ok: true, message: label, status: patch.status, projectName: row.project_name || row.project_id });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 500);
  }
}
