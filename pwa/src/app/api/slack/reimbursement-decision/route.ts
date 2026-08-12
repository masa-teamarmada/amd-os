import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyReimbursementDecision,
  ReimbursementDecisionError,
  type ReimbursementDecisionAction,
} from "@/lib/reimbursement-decision";

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
  const action = String(body.action ?? "").trim() as ReimbursementDecisionAction;
  const approverEmail = String(body.approverEmail ?? "").trim().toLowerCase();

  if (!reimbursementId) return fail("reimbursementId が空");
  if (!approverEmail) return fail("Slack アカウントに紐づくメールが解決できなかった");

  try {
    const result = await applyReimbursementDecision(createAdminClient(), {
      reimbursementId,
      action,
      approverEmail,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return fail(
      e instanceof Error ? e.message : String(e),
      e instanceof ReimbursementDecisionError ? e.status : 500,
    );
  }
}
