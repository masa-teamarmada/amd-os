/**
 * 「立替精算」の承認 — AMD OS 本体へ中継するだけ。
 *
 * 判定・状態遷移・通知（Slack / メール）はすべて本体の
 * /api/reimbursements/decision が持っている。ここではその判断をコピーしない。
 * ログインしている人が誰かも本体側で判定されるので、承認者の記録も本体基準になる。
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { callAmdOs } from "@/lib/amd-os";

export const runtime = "nodejs";

/** 本体 pwa/src/lib/reimbursement-decision.ts が受け付ける操作。 */
const ACTIONS = new Set([
  "reimb_approve",
  "reimb_reject",
  "reimb_admin_approve",
  "reimb_admin_reject",
]);

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: { reimbursementId?: unknown; action?: unknown };
  try {
    body = (await req.json()) as { reimbursementId?: unknown; action?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const reimbursementId = typeof body.reimbursementId === "string" ? body.reimbursementId.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!reimbursementId || !ACTIONS.has(action)) {
    return NextResponse.json(
      { ok: false, error: "reimbursementId と action（承認/却下）が必要" },
      { status: 400 }
    );
  }

  const result = await callAmdOs("/api/reimbursements/decision", {
    method: "POST",
    body: { reimbursementId, action },
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
